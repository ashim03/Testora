import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Volume2,
  VolumeX,
  Music,
} from "lucide-react";
import { fetchAuthBlob } from "../../api/client";
import { cn, formatAudioTime, getErrorMessage } from "../../utils";
import { Button } from "../ui/button";

export interface AudioPlayRules {
  maxPlays?: number | null;
  allowSeek?: boolean;
}

export interface AudioPlayerProps {
  src: string;
  assetId?: string;
  rules?: AudioPlayRules | null;
  storageKey?: string;
  compact?: boolean;
  className?: string;
  label?: string;
}

interface LoadState {
  status: "loading" | "ready" | "error";
  blobUrl?: string;
  message?: string;
}

function readPlays(key: string): number {
  try {
    return Number(localStorage.getItem(`ielts_audio_plays_${key}`) || 0) || 0;
  } catch {
    return 0;
  }
}

function writePlays(key: string, count: number): void {
  try {
    localStorage.setItem(`ielts_audio_plays_${key}`, String(count));
  } catch {
    // storage unavailable
  }
}

const activePlayers = new Set<{ element: HTMLAudioElement; id: string }>();

function pauseOthers(id: string, _current: HTMLAudioElement): void {
  for (const p of activePlayers) {
    if (p.id !== id && !p.element.paused) {
      try {
        p.element.pause();
      } catch {
        // ignore
      }
    }
  }
}

export function AudioPlayer({
  src,
  rules,
  storageKey,
  compact = false,
  className,
  label = "Question audio",
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [id] = useState(() => `p_${Math.random().toString(36).slice(2)}`);

  const maxPlays = rules?.maxPlays ?? null;
  const allowSeek = rules?.allowSeek !== false;

  const countKey = useMemo(
    () => storageKey || src,
    [storageKey, src],
  );
  const [plays, setPlays] = useState(() => (maxPlays ? readPlays(countKey) : 0));

  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [dragTime, setDragTime] = useState<number | null>(null);

  const playsRemaining = maxPlays ? Math.max(0, maxPlays - plays) : null;
  const playLocked = maxPlays != null && plays >= maxPlays;

  const isRemote = src.startsWith("http") || src.startsWith("data:");

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoad({ status: "loading" });

    if (isRemote) {
      setLoad({ status: "ready", blobUrl: src });
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const blob = await fetchAuthBlob(src);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setLoad({ status: "ready", blobUrl: objectUrl });
      } catch (err) {
        if (cancelled) return;
        setLoad({ status: "error", message: getErrorMessage(err) });
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    activePlayers.add({ element: audio, id });
    return () => {
      activePlayers.delete({ element: audio, id });
    };
  }, [id]);

  const syncVolume = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    syncVolume();
  }, [syncVolume]);

  useEffect(() => {
    setPlays(maxPlays ? readPlays(countKey) : 0);
    setCurrentTime(0);
    setEnded(false);
    setDragTime(null);
  }, [countKey, maxPlays]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => {
      setPlaying(true);
      setEnded(false);
      pauseOthers(id, audio);
    };
    const onPause = () => setPlaying(false);
    const onTime = () => {
      if (!dragTime) setCurrentTime(audio.currentTime);
      if (audio.duration && Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onMeta = () => {
      if (audio.duration && Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onCanPlay = () => setBuffering(false);
    const onEnded = () => {
      setPlaying(false);
      setEnded(true);
      setCurrentTime(audio.duration || 0);
      setBuffering(false);
      if (maxPlays) {
        const next = readPlays(countKey) + 1;
        writePlays(countKey, next);
        setPlays(next);
      }
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("ended", onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load.blobUrl, dragTime, maxPlays, countKey]);

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio || playLocked) return;
    if (audio.paused) {
      if (ended || audio.currentTime >= (audio.duration || 0) - 0.1) {
        audio.currentTime = 0;
      }
      try {
        await audio.play();
      } catch {
        // playback blocked
      }
    } else {
      audio.pause();
    }
  }

  function seekTo(value: number) {
    const audio = audioRef.current;
    if (!audio || !allowSeek || playLocked) return;
    audio.currentTime = value;
    setCurrentTime(value);
    setEnded(false);
  }

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const btnSize = compact ? "size-10" : "size-11";
  const iconSize = compact ? "size-4" : "size-5";

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-muted/30 p-3",
        compact ? "w-full max-w-md" : "w-full",
        className,
      )}
    >
      <audio
        ref={audioRef}
        src={load.blobUrl}
        preload="metadata"
        className="hidden"
        aria-label={label}
      />

      {load.status === "error" ? (
        <div className="flex items-center justify-between gap-3" role="alert">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className={iconSize} />
            <span>{load.message || "Failed to load audio."}</span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" /> Retry
          </Button>
        </div>
      ) : load.status === "loading" ? (
        <div className="flex min-h-[44px] items-center gap-2 text-sm text-muted-foreground" role="status" aria-label="Loading audio">
          <Loader2 className={cn(iconSize, "animate-spin")} />
          <span>Loading audio…</span>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="icon"
            variant={playing ? "secondary" : "default"}
            className={cn("shrink-0 rounded-full", btnSize)}
            onClick={() => void togglePlay()}
            disabled={playLocked}
            aria-label={playing ? "Pause audio" : playLocked ? "Play limit reached" : "Play audio"}
            title={playLocked ? `Play limit reached (${maxPlays} max)` : playing ? "Pause" : "Play"}
          >
            {playLocked ? (
              <span className={cn("inline-flex items-center gap-1", iconSize)}>
                <Music className={iconSize} />
              </span>
            ) : buffering ? (
              <Loader2 className={cn(iconSize, "animate-spin")} />
            ) : playing ? (
              <Pause className={iconSize} />
            ) : (
              <Play className={cn(iconSize, "ml-0.5")} />
            )}
          </Button>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              {allowSeek ? (
                <input
                  type="range"
                  min={0}
                  max={duration > 0 ? Math.floor(duration) : 0}
                  step={1}
                  value={dragTime ?? Math.floor(currentTime)}
                  disabled={playLocked}
                  onChange={(e) => setDragTime(Number(e.target.value))}
                  onMouseUp={() => { if (dragTime != null) { seekTo(dragTime); setDragTime(null); } }}
                  onTouchEnd={() => { if (dragTime != null) { seekTo(dragTime); setDragTime(null); } }}
                  onKeyUp={() => { if (dragTime != null) { seekTo(dragTime); setDragTime(null); } }}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-brand-600 disabled:opacity-50"
                  aria-label="Seek audio progress"
                  aria-valuemin={0}
                  aria-valuemax={Math.floor(duration)}
                  aria-valuenow={Math.floor(dragTime ?? currentTime)}
                />
              ) : (
                <div
                  className="relative h-1.5 w-full overflow-hidden rounded-full bg-border"
                  role="progressbar"
                  aria-label="Audio progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progressPct)}
                >
                  <div className="absolute inset-y-0 left-0 rounded-full bg-brand-600" style={{ width: `${progressPct}%` }} />
                </div>
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
              <span>{formatAudioTime(dragTime ?? currentTime)}</span>
              <span>{formatAudioTime(duration)}</span>
            </div>
          </div>

          {!compact && (
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-9 rounded-full"
                onClick={() => {
                  setMuted((m) => {
                    const next = !m;
                    const audio = audioRef.current;
                    if (audio) audio.muted = next;
                    return next;
                  });
                }}
                aria-label={muted ? "Unmute audio" : "Mute audio"}
              >
                {muted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </Button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  setMuted(v === 0);
                  const audio = audioRef.current;
                  if (audio) {
                    audio.volume = v;
                    audio.muted = v === 0;
                  }
                }}
                className="w-16 cursor-pointer accent-brand-600"
                aria-label="Volume"
                aria-valuemin={0}
                aria-valuemax={1}
                aria-valuenow={muted ? 0 : volume}
                aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)} percent`}
              />
            </div>
          )}
        </div>
      )}

      {playLocked && (
        <p className="text-xs text-muted-foreground">
          Play limit reached ({maxPlays} of {maxPlays} plays used). You cannot replay this audio.
        </p>
      )}
      {!playLocked && playsRemaining != null && (
        <p className="text-xs text-muted-foreground">{playsRemaining} play{playsRemaining === 1 ? "" : "s"} remaining</p>
      )}
      {!playLocked && !allowSeek && (
        <p className="text-xs text-muted-foreground">Seeking is disabled for this audio.</p>
      )}
    </div>
  );
}