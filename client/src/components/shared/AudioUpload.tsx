import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AudioLines, Loader2, Trash2, UploadCloud } from "lucide-react";
import { deleteAudioFile, listAudioFiles, uploadFile } from "../../api/client";
import { cn, formatAudioTime, getErrorMessage } from "../../utils";
import { Button } from "../ui/button";
import { AudioPlayer, type AudioPlayRules } from "./AudioPlayer";

export interface AudioUploadValue {
  url: string;
  assetId?: string;
  duration?: number;
  rules?: AudioPlayRules | null;
}

export interface AudioUploadProps {
  value?: AudioUploadValue | null;
  onChange: (value: AudioUploadValue | null) => void;
  label?: string;
  maxSizeMb?: number;
  storageKey?: string;
  showRules?: boolean;
}

const ACCEPT = "audio/*,.mp3,.wav,.m4a,.aac,.webm,.ogg,.mp4";
const AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/webm",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/x-aac",
  "audio/ogg",
];

async function readDuration(file: File): Promise<number> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<number>((resolve) => {
      const audio = new Audio();
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        const d = audio.duration;
        URL.revokeObjectURL(url);
        resolve(Number.isFinite(d) && d > 0 ? Math.round(d) : 0);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(0);
      };
      audio.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function AudioUpload({
  value,
  onChange,
  label = "Question audio",
  maxSizeMb = 30,
  showRules = true,
}: AudioUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<Array<{ assetId: string; url: string; size: number; mimeType: string }>>([]);
  const [useExisting, setUseExisting] = useState(false);

  const rules: AudioPlayRules = {
    maxPlays: value?.rules?.maxPlays ?? null,
    allowSeek: value?.rules?.allowSeek !== false,
  };

  useEffect(() => {
    let alive = true;
    listAudioFiles()
      .then((files) => {
        if (alive) setExisting(files.filter((f) => f.url));
      })
      .catch(() => { /* keep empty list */ });
    return () => {
      alive = false;
    };
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      const typeOk = AUDIO_TYPES.includes(file.type) || /\.(mp3|wav|m4a|aac|webm|ogg|mp4)$/i.test(file.name);
      if (!typeOk) {
        setError("Unsupported audio type. Please upload MP3, WAV, M4A or AAC.");
        return;
      }
      if (file.size > maxSizeMb * 1024 * 1024) {
        setError(`Audio too large. Max ${maxSizeMb} MB.`);
        return;
      }
      setBusy(true);
      setProgress(0);
      try {
        const result = await uploadFile(file, "AUDIO", setProgress);
        if (!result.url) throw new Error("Upload failed");
        const duration = await readDuration(file);
        const prevRules = rules;
        onChange({ url: result.url, assetId: result.assetId, duration, rules: prevRules });
        setUseExisting(false);
        toast.success("Audio uploaded");
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [maxSizeMb, onChange],
  );

  function openPicker(e: React.MouseEvent) {
    e.stopPropagation();
    inputRef.current?.click();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  function setRules(next: Partial<AudioPlayRules>) {
    onChange(value ? { ...value, rules: { ...rules, ...next } } : null);
  }

  async function remove(u = value) {
    if (u?.assetId) {
      try {
        await deleteAudioFile(u.assetId);
      } catch {
        // ignore - cleanup best effort
      }
    }
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />

      {value?.url ? (
        <div className="space-y-2">
          <AudioPlayer
            src={value.url}
            rules={{ maxPlays: null, allowSeek: true }}
            compact
            label={label}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={openPicker}>
              <UploadCloud className="size-4" /> Replace audio
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => void remove()}>
              <Trash2 className="size-4" /> Remove
            </Button>
            {value.duration ? <span className="text-xs text-muted-foreground">{formatAudioTime(value.duration)} duration</span> : null}
          </div>
        </div>
      ) : (
        <div
          onClick={openPicker}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          aria-label={label}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") openPicker(e as unknown as React.MouseEvent);
          }}
          className={cn(
            "flex min-h-[72px] cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-muted/40 px-4 py-3 text-center transition-colors",
            dragOver && "border-brand-500 bg-brand-50 dark:bg-brand-950/30",
            busy && "pointer-events-none",
          )}
        >
          {busy ? (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Uploading… {progress}%
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <AudioLines className="size-5" /> Drag & drop or click to upload audio
            </span>
          )}
        </div>
      )}

      {!value?.url && existing.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            type="button"
            variant={useExisting ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setUseExisting((v) => !v)}
          >
            Use previously uploaded audio ({existing.length})
          </Button>
        </div>
      )}

      {!value?.url && useExisting && (
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
          {existing.map((f) => (
            <button
              key={f.assetId}
              type="button"
              onClick={() => {
                onChange({ url: f.url, assetId: f.assetId, duration: undefined, rules });
                setUseExisting(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              <AudioLines className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{f.mimeType.replace("audio/", "")} · {(f.size / 1024 / 1024).toFixed(1)} MB</span>
            </button>
          ))}
        </div>
      )}

      {showRules && value?.url && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
          <label className="flex items-center gap-2 text-sm">
            <span>Max plays</span>
            <select
              className="rounded-md border px-2 py-1 text-sm"
              value={rules.maxPlays == null ? "unlimited" : String(rules.maxPlays)}
              onChange={(e) => {
                const v = e.target.value;
                setRules({
                  maxPlays: v === "unlimited" ? null : Number(v),
                });
              }}
            >
              <option value="unlimited">Unlimited</option>
              <option value="1">1 play</option>
              <option value="2">2 plays</option>
              <option value="3">3 plays</option>
              <option value="5">5 plays</option>
              <option value="10">10 plays</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={rules.allowSeek === false}
              onChange={(e) => setRules({ allowSeek: !e.target.checked })}
              className="accent-brand-600"
            />
            Disable seeking
          </label>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}