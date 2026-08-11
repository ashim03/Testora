import multer from "multer";
import path from "path";
import { config } from "../config";
import { ApiError } from "../utils/helpers";

const ALLOWED_MIME: Record<string, string[]> = {
  PROFILE_IMAGE: ["image/png", "image/jpeg", "image/webp"],
  QUESTION_IMAGE: ["image/png", "image/jpeg", "image/webp"],
  AUDIO: [
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
  ],
  DOCUMENT: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
  ],
};

const EXT_BY_KIND: Record<string, string[]> = {
  PROFILE_IMAGE: [".png", ".jpg", ".jpeg", ".webp"],
  QUESTION_IMAGE: [".png", ".jpg", ".jpeg", ".webp"],
  AUDIO: [".mp3", ".wav", ".webm", ".m4a", ".aac", ".ogg", ".mp4"],
  DOCUMENT: [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".csv"],
};

type UploadKind = "PROFILE_IMAGE" | "QUESTION_IMAGE" | "AUDIO" | "DOCUMENT";

export function uploadForKind(kind: UploadKind) {
  const mimeSet = new Set(ALLOWED_MIME[kind] ?? []);
  const extSet = EXT_BY_KIND[kind] ?? [];
  const maxBytes = config.maxFileSizeMb * 1024 * 1024;

  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!mimeSet.has(file.mimetype) && !extListCheck(extSet, ext)) {
        cb(new ApiError(400, `Invalid file type: ${file.mimetype || ext}`));
        return;
      }
      cb(null, true);
    },
  }).single("file");
}

export const uploadDocSingle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxFileSizeMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
    if (!allowed.includes(file.mimetype) && !file.originalname.toLowerCase().endsWith(".csv")) {
      cb(new ApiError(400, "Please upload a CSV file"));
      return;
    }
    cb(null, true);
  },
}).single("file");

function extListCheck(extList: string[], ext: string): boolean {
  return extList.includes(ext);
}

export const mimeToKind = (mime: string): UploadKind | null => {
  if (mime.startsWith("image/")) return "QUESTION_IMAGE";
  if (mime.startsWith("audio/")) return "AUDIO";
  return "DOCUMENT";
};