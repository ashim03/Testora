import { Router } from "express";
import multer from "multer";
import * as media from "../controllers/mediaController";
import { authenticate } from "../middleware/auth";
import { ApiError } from "../utils/helpers";
import { config } from "../config";

const MIME_BY_KIND: Record<string, Set<string>> = {
  PROFILE_IMAGE: new Set(["image/png", "image/jpeg", "image/webp"]),
  LOGO: new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]),
  QUESTION_IMAGE: new Set(["image/png", "image/jpeg", "image/webp"]),
  AUDIO: new Set([
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
  ]),
  DOCUMENT: new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
  ]),
  ASSIGNMENT: new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "image/png",
    "image/jpeg",
    "image/webp",
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/webm",
    "audio/mp4",
    "audio/m4a",
    "audio/x-m4a",
    "audio/ogg",
    "video/mp4",
    "video/webm",
    "video/quicktime",
  ]),
};

function maxBytesFor(kind: string): number {
  if (kind === "AUDIO") return config.audioMaxSizeMb * 1024 * 1024;
  return config.maxFileSizeMb * 1024 * 1024;
}

const um = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(maxBytesFor("AUDIO"), config.maxFileSizeMb * 1024 * 1024), files: 1 },
  fileFilter: (req, file, cb) => {
    const kind = (req.query.kind as string) || (req.body.kind as string) || "DOCUMENT";
    if (!kind || !MIME_BY_KIND[kind]) {
      cb(new ApiError(400, "Unsupported upload kind"));
      return;
    }
    if (!MIME_BY_KIND[kind].has(file.mimetype)) {
      cb(new ApiError(400, `Invalid file type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

router.post("/upload", authenticate, um.single("file"), media.uploadFile);

router.get("/audio", authenticate, media.listAudios);
router.get("/audio/:id/file", authenticate, media.streamAudio);
router.delete("/audio/:id", authenticate, media.deleteAudio);

export default router;