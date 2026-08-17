import { useEffect, useRef, useState } from "react";
import { Mic, Square, Pause, Play, RotateCcw, X, Loader2, AlertTriangle, MicOff } from "lucide-react";
import { Button } from "../ui/button";
import { formatAudioTime } from "../../utils";

export type RecorderStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "paused"
  | "uploading"
  | "recorded";

export type RecorderErrorKind = "unsupported" | "denied" | "unavailable" | "generic";

export interface RecorderError {
  kind: RecorderErrorKind;
  message: string;
}

export function isVoiceRecordingSupported(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof window !== "undefined" && typeof MediaRecorder !== "undefined";
}

interface VoiceRecorderProps {
  onComplete: (blob: Blob, durationSec: number) => void;
  maxDurationSec?: number;
  minDurationSec?: number;
  disabled?: boolean;
}

export function VoiceRecorder({ onComplete, maxDurationSec = 180, minDurationSec = 5, disabled }: VoiceRecorderProps) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<RecorderError | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const activeStartRef = useRef<number>(0);
  const accumulatedRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusRef = useRef<RecorderStatus>("idle");

  const updateStatus = (next: RecorderStatus) => {
    statusRef.current = next;
    setStatus(next);
  };

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function stopTracks() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    return () => {
      clearTimer();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {
          // recorder may already be dead
        }
      }
      stopTracks();
      if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function currentElapsed(): number {
    return (statusRef.current === "recording" ? accumulatedRef.current + (Date.now() - activeStartRef.current) / 1000 : accumulatedRef.current);
  }

  function startTimer() {
    activeStartRef.current = Date.now();
    clearTimer();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor(currentElapsed()));
      if (currentElapsed() >= maxDurationSec && statusRef.current === "recording") {
        stopRecording();
      }
    }, 250);
  }

  async function requestPermission(): Promise<MediaStream> {
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  }

  async function startRecording() {
    if (disabled) return;
    if (!isVoiceRecordingSupported()) {
      setError({ kind: "unsupported", message: "Your browser does not support voice recording. Please use a recent version of Chrome, Edge, Firefox or Safari." });
      return;
    }
    setError(null);
    updateStatus("requesting");
    try {
      const stream = await requestPermission();
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        onStop(recorder);
      };
      recorderRef.current = recorder;
      accumulatedRef.current = 0;
      setElapsed(0);
      recorder.start(250);
      updateStatus("recording");
      startTimer();
    } catch (err) {
      stopTracks();
      updateStatus("idle");
      handlePermissionError(err);
    }
  }

  function handlePermissionError(err: unknown) {
    const name = err instanceof Error ? err.name : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      setError({ kind: "denied", message: "Microphone access was denied. Enable the microphone in your browser settings, then try again." });
    } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      setError({ kind: "unavailable", message: "No microphone was found on this device. Connect a microphone and try again." });
    } else {
      setError({ kind: "generic", message: "Could not access the microphone. Please check your browser permissions." });
    }
  }

  function onStop(recorder: MediaRecorder) {
    clearTimer();
    const type = recorder.mimeType || "audio/webm";
    const recorded = new Blob(chunksRef.current, { type });
    chunksRef.current = [];
    stopTracks();
    recorderRef.current = null;
    const duration = Math.max(1, Math.round(currentElapsed()));
    setBlob(recorded);
    setElapsed(duration);
    updateStatus("recorded");
    onComplete(recorded, duration);
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // stop can throw if recording already ended
      }
    }
  }

  function pauseRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording" && recorder.pause) {
      accumulatedRef.current = currentElapsed();
      clearTimer();
      recorder.pause();
      updateStatus("paused");
      setElapsed(Math.floor(accumulatedRef.current));
    }
  }

  function resumeRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "paused" && recorder.resume) {
      recorder.resume();
      updateStatus("recording");
      startTimer();
    }
  }

  function cancel() {
    clearTimer();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      } catch {
        // already stopped
      }
    }
    recorderRef.current = null;
    stopTracks();
    chunksRef.current = [];
    accumulatedRef.current = 0;
    setElapsed(0);
    setBlob(null);
    if (playbackUrl) {
      URL.revokeObjectURL(playbackUrl);
      setPlaybackUrl(null);
    }
    updateStatus("idle");
  }

  function reRecord() {
    cancel();
    void startRecording();
  }

  useEffect(() => {
    if (status === "recorded" && blob) {
      const url = URL.createObjectURL(blob);
      setPlaybackUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return url;
      });
    }
  }, [status, blob]);

  const tooShort = status === "recorded" && blob && elapsed < minDurationSec;
  const busy = status === "requesting" || status === "uploading";

  return (
    <div className="space-y-3">
      {!isVoiceRecordingSupported() ? (
        <p className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <MicOff className="size-4 shrink-0" />
          Voice recording is not supported in this browser. Use a recent version of Chrome, Edge, Firefox or Safari.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {status === "idle" && (
              <Button type="button" onClick={() => void startRecording()} disabled={disabled || busy}>
                <Mic className="size-4" /> Start recording
              </Button>
            )}
            {status === "requesting" && (
              <Button type="button" disabled>
                <Loader2 className="size-4 animate-spin" /> Requesting microphone…
              </Button>
            )}
            {(status === "recording" || status === "paused") && (
              <>
                <Button type="button" variant="destructive" onClick={stopRecording} data-testid="recorder-stop">
                  <Square className="size-4" /> Stop
                </Button>
                {status === "recording" ? (
                  <Button type="button" variant="outline" onClick={pauseRecording} data-testid="recorder-pause">
                    <Pause className="size-4" /> Pause
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={resumeRecording} data-testid="recorder-resume">
                    <Play className="size-4" /> Resume
                  </Button>
                )}
                <Button type="button" variant="ghost" onClick={cancel} aria-label="Cancel recording">
                  <X className="size-4" />
                </Button>
              </>
            )}
            {status === "recorded" && (
              <>
                <Button type="button" variant="outline" onClick={reRecord} data-testid="recorder-rerecord">
                  <RotateCcw className="size-4" /> Re-record
                </Button>
                <Button type="button" variant="ghost" onClick={cancel} aria-label="Discard recording">
                  <X className="size-4" /> Discard
                </Button>
              </>
            )}
            {status === "uploading" && (
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> Uploading audio…
              </span>
            )}
          </div>

          {(status === "recording" || status === "paused") && (
            <p className="inline-flex items-center gap-2 text-sm font-medium text-destructive" data-testid="recorder-timer">
              <span className={`size-2 rounded-full bg-destructive ${status === "recording" ? "animate-pulse" : ""}`} />
              {status === "paused" ? "Paused · " : "Recording "}
              {formatAudioTime(elapsed)}
              <span className="text-muted-foreground">/ {formatAudioTime(maxDurationSec)}</span>
            </p>
          )}

          {status === "recorded" && playbackUrl && (
            <div className="space-y-2" data-testid="recorder-playback">
              <audio controls src={playbackUrl} className="w-full max-w-md" />
              {tooShort && (
                <p className="flex items-center gap-1.5 text-xs text-amber-600">
                  <AlertTriangle className="size-3 shrink-0" />
                  Recording is {formatAudioTime(elapsed)} — at least {formatAudioTime(minDurationSec)} is needed for assessment.
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert" data-testid="recorder-error">
              <MicOff className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0">
                {error.message}
                {error.kind === "denied" && (
                  <button type="button" className="ml-2 underline" onClick={() => void startRecording()}>
                    Try again
                  </button>
                )}
              </span>
            </p>
          )}
        </>
      )}
    </div>
  );
}