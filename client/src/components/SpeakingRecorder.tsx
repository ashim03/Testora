import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Mic, Square, RotateCcw, Loader2 } from "lucide-react";
import { uploadFile } from "../api/client";
import { Button } from "./ui/button";
import { getErrorMessage } from "../utils";

export const AUDIO_QUESTION_TYPES = new Set([
  "READ_ALOUD",
  "REPEAT_SENTENCE",
  "DESCRIBE_IMAGE",
  "RETELL_LECTURE",
  "SPEAKING_RESPONSE",
  "AUDIO_RESPONSE",
]);

export interface SpeakingAnswer {
  url?: string;
  assetId?: string;
  duration?: number;
  recordedAt?: string;
}

export function speakingAnswerValue(value: unknown): SpeakingAnswer {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if (typeof obj.url === "string" && obj.url.trim()) {
      return {
        url: obj.url,
        assetId: typeof obj.assetId === "string" ? obj.assetId : undefined,
        duration: typeof obj.duration === "number" ? obj.duration : undefined,
        recordedAt: typeof obj.recordedAt === "string" ? obj.recordedAt : undefined,
      };
    }
  }
  if (typeof value === "string" && value.trim()) return { url: value };
  return {};
}

export function SpeakingRecorder({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (value: SpeakingAnswer | undefined, answered: boolean) => void;
}) {
  const [recording, setRecording] = useState<MediaRecorder | null>(null);
  const [duration, setDuration] = useState(0);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const saved = speakingAnswerValue(value);
  const playbackUrl = pendingUrl || saved.url;

  function stopTracks() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(() => stopTracks, []);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
        const localUrl = URL.createObjectURL(blob);
        chunksRef.current = [];
        stopTracks();
        setPendingUrl(localUrl);
        setRecording(null);
        void uploadAudio(blob, localUrl);
      };
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      setRecording(rec);
      rec.start();
    } catch {
      toast.error("Microphone access denied. Enable the mic in your browser to record speaking answers.");
    }
  }

  async function uploadAudio(blob: Blob, localUrl: string) {
    setUploading(true);
    try {
      const file = new File([blob], `speaking-${Date.now()}.webm`, { type: blob.type || "audio/webm" });
      const result = await uploadFile(file, "AUDIO");
      if (!result.url) throw new Error("Upload failed");
      onChange({ url: result.url, assetId: result.assetId, duration, recordedAt: new Date().toISOString() }, true);
      setPendingUrl(null);
      URL.revokeObjectURL(localUrl);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setPendingUrl(null);
      URL.revokeObjectURL(localUrl);
      onChange(undefined, false);
    } finally {
      setUploading(false);
    }
  }

  function stopAndUpload() {
    if (recording && recording.state !== "inactive") {
      recording.stop();
    }
  }

  function clear() {
    onChange(undefined, false);
    setPendingUrl(null);
  }

  const mins = Math.floor(duration / 60);
  const secs = (duration % 60).toString().padStart(2, "0");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {recording ? (
          <Button type="button" size="sm" variant="destructive" onClick={stopAndUpload}>
            <Square className="size-4" /> Stop recording
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={() => void startRecording()}>
            <Mic className="size-4" /> Record
          </Button>
        )}
        {!recording && playbackUrl && (
          <Button type="button" size="sm" variant="outline" onClick={clear}>
            <RotateCcw className="size-4" /> Remove
          </Button>
        )}
        {uploading && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Uploading audio...
          </span>
        )}
      </div>

      {recording && (
        <p className="inline-flex items-center gap-2 text-sm font-medium text-destructive">
          <span className="size-2 animate-pulse rounded-full bg-destructive" />
          Recording {mins}:{secs}
        </p>
      )}
      {!recording && playbackUrl && <audio controls src={playbackUrl} className="w-full max-w-sm" />}
    </div>
  );
}
