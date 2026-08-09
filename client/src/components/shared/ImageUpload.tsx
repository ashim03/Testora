import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";
import { uploadFile } from "../../api/client";
import { cn, getErrorMessage } from "../../utils";
import { Button } from "../ui/button";

export interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string) => void;
  onRemove?: () => void;
  kind?: string;
  label?: string;
  accept?: string;
  maxSizeMb?: number;
  maxDimension?: number;
  shape?: "circle" | "square";
}

const DEFAULT_ACCEPT = "image/png,image/jpeg,image/webp";

export function ImageUpload({
  value,
  onChange,
  onRemove,
  kind = "PROFILE_IMAGE",
  label = "Upload image",
  accept = DEFAULT_ACCEPT,
  maxSizeMb = 5,
  maxDimension = 1280,
  shape = "circle",
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      const okTypes = accept.split(",");
      if (!okTypes.includes(file.type)) {
        setError(`Unsupported file type. Use ${accept.split("/").pop()?.replace("x-", "/").replace(", ", ", ")}`);
        return;
      }
      if (file.size > maxSizeMb * 1024 * 1024) {
        setError(`Image too large. Max ${maxSizeMb} MB.`);
        return;
      }
      setBusy(true);
      setProgress(0);
      try {
        const optimized = await compressImage(file, maxDimension);
        const objectUrl = URL.createObjectURL(optimized);
        setPreviewUrl(objectUrl);
        const result = await uploadFile(optimized, kind, setProgress);
        onChange(result.url ?? "");
        toast.success("Image uploaded");
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, maxSizeMb, maxDimension, onChange],
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

  const showPreview = value || previewUrl;

  return (
    <div className="flex items-start gap-4">
      <div
        onClick={openPicker}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "group relative shrink-0 cursor-pointer overflow-hidden border-2 border-dashed bg-muted/40 transition-colors",
          shape === "circle" ? "size-24 rounded-full" : "size-24 rounded-xl",
          dragOver && "border-brand-500 bg-brand-50 dark:bg-brand-950/30",
          busy && "pointer-events-none",
        )}
        role="button"
        tabIndex={0}
        aria-label={label}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") openPicker(e as unknown as React.MouseEvent);
        }}
      >
        {showPreview ? (
          <img src={showPreview ?? undefined} alt="preview" className="size-full object-cover" />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <ImagePlus className="size-6" />
            <span className="px-1 text-center text-[11px] leading-tight">{label}</span>
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/70">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-[11px]">{progress}%</span>
          </span>
        )}
      </div>

      <div className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={openPicker}>
            <UploadCloud className="size-4" /> Choose
          </Button>
          {onRemove && (value || previewUrl) && (
            <Button type="button" variant="ghost" size="sm" onClick={() => { setPreviewUrl(null); onRemove(); }}>
              <Trash2 className="size-4" /> Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><UploadCloud className="size-3" /> Drag & drop or {`${accept.split(",")[0]?.split("/").pop() || ""}`}</span>
        </p>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}

async function compressImage(file: File, maxDimension: number): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
    if (scale === 1 && file.size <= 512 * 1024) return file;
    const width = Math.round(img.width * scale);
    const height = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);
    const wantsWebp = file.type === "image/webp";
    const quality = 0.85;
    const ext = wantsWebp ? "image/webp" : "image/jpeg";
    const converted = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, ext, quality));
    return new File([converted ?? file], file.name.replace(/\.\w+$/, ".jpg"), { type: ext });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}