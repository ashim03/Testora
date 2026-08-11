import { Request, Response } from "express";
import fs from "fs";
import { Types } from "mongoose";
import { getMediaService, localAudioPath } from "../services/mediaService";
import { ApiError, asyncHandler } from "../utils/helpers";
import { mimeToKind } from "../middleware/upload";
import { config } from "../config";
import { MediaAsset, Question, Exam, ExamAttempt, ExamAssignment } from "../models";

export const uploadFile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  if (!req.file) throw new ApiError(400, "No file provided");
  const kind = (req.body.kind as string) || mimeToKind(req.file.mimetype) || "DOCUMENT";
  const sizeMb = req.file.size / 1024 / 1024;
  const limitMb = kind === "AUDIO" ? config.audioMaxSizeMb : config.maxFileSizeMb;
  if (sizeMb > limitMb) {
    throw new ApiError(400, `File too large. Max ${limitMb} MB.`);
  }
  const service = getMediaService();
  const stored = await service.upload({
    buffer: req.file.buffer,
    mimeType: req.file.mimetype,
    kind,
    filename: req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_").slice(0, 80),
    userId: req.user.id,
  });
  res.json({ success: true, message: "File uploaded", data: stored });
});

const AUDIO_MIME: Record<string, string> = {
  "audio/mpeg": "audio/mpeg",
  "audio/mp3": "audio/mpeg",
  "audio/wav": "audio/wav",
  "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/webm": "audio/webm",
  "audio/mp4": "audio/mp4",
  "audio/m4a": "audio/mp4",
  "audio/x-m4a": "audio/mp4",
  "audio/aac": "audio/aac",
  "audio/x-aac": "audio/aac",
  "audio/ogg": "audio/ogg",
};

export const listAudios = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const assets = await MediaAsset.find({ kind: "AUDIO", uploadedBy: req.user.id })
    .sort({ createdAt: -1 })
    .limit(100)
    .select("url publicId mimeType size createdAt")
    .lean();
  res.json({
    success: true,
    message: "Audio files",
    data: assets.map((a) => ({
      assetId: String(a._id),
      url: a.url,
      mimeType: a.mimeType,
      size: a.size,
      createdAt: a.createdAt,
      provider: a.provider,
    })),
  });
});

export const deleteAudio = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const idParam = String(req.params.id);
  if (!Types.ObjectId.isValid(idParam)) throw new ApiError(404, "Audio file not found");
  const asset = await MediaAsset.findOne({ _id: idParam, kind: "AUDIO" });
  if (!asset) throw new ApiError(404, "Audio file not found");
  if (String(asset.uploadedBy) !== String(req.user.id) && req.user.role !== "SUPER_ADMIN") {
    throw new ApiError(403, "You can only delete your own audio files");
  }
  const service = getMediaService();
  await service.remove(asset.publicId || "");
  await MediaAsset.deleteOne({ _id: asset._id });
  await Question.updateMany(
    { audioAssetId: asset._id },
    { $set: { audioAssetId: null, audioUrl: null, audioDuration: null } },
  );
  res.json({ success: true, message: "Audio file deleted" });
});

export const streamAudio = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const idParam = String(req.params.id);
  if (!Types.ObjectId.isValid(idParam)) throw new ApiError(404, "Audio file not found");
  const asset = await MediaAsset.findOne({ _id: idParam, kind: "AUDIO" });
  if (!asset) throw new ApiError(404, "Audio file not found");

  const allowed = await canAccessAudio(String(asset._id), req.user.id, req.user.role);
  if (!allowed) throw new ApiError(403, "You do not have access to this audio file");

  if (asset.provider === "cloudinary" && asset.url) {
    res.redirect(302, asset.url);
    return;
  }

  if (asset.provider === "local" && (!asset.publicId || asset.url.startsWith("data:"))) {
    throw new ApiError(404, "Audio file not hosted for streaming");
  }

  const filePath = localAudioPath(asset.publicId || String(asset._id));
  if (!fs.existsSync(filePath)) throw new ApiError(404, "Audio file missing on server");

  const mime = AUDIO_MIME[asset.mimeType] || "audio/mpeg";
  const stat = fs.statSync(filePath);
  const range = req.headers.range;

  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", mime);
  res.setHeader("Cache-Control", "private, max-age=3600");

  if (range) {
    const parts = /^bytes=(\d*)-(\d*)$/.exec(range);
    const start = parts && parts[1] ? parseInt(parts[1], 10) : 0;
    const end = parts && parts[2] ? parseInt(parts[2], 10) : stat.size - 1;
    if (Number.isNaN(start) || start >= stat.size || end < start) {
      res.status(416).setHeader("Content-Range", `bytes */${stat.size}`);
      res.end();
      return;
    }
    const chunkEnd = Math.min(end, stat.size - 1);
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${chunkEnd}/${stat.size}`);
    res.setHeader("Content-Length", String(chunkEnd - start + 1));
    fs.createReadStream(filePath, { start, end: chunkEnd }).pipe(res);
    return;
  }

  res.setHeader("Content-Length", String(stat.size));
  fs.createReadStream(filePath).pipe(res);
});

async function canAccessAudio(assetId: string, userId: string, role: string): Promise<boolean> {
  if (role === "SUPER_ADMIN") return true;
  const asset = await MediaAsset.findById(assetId).lean();
  if (!asset) return false;
  if (String(asset.uploadedBy) === String(userId)) return true;

  const questions = await Question.find({ audioAssetId: assetId, deletedAt: null }).select("_id").lean();
  if (questions.length === 0) return false;
  const qids = questions.map((q) => q._id);

  const exams = await Exam.find({
    deletedAt: null,
    $or: [{ questionIds: { $in: qids } }, { "sections.questionIds": { $in: qids } }],
  }).select("_id").lean();
  const examIds = exams.map((e) => e._id);
  if (examIds.length === 0) return false;

  const [hasAttempt, hasAssignment] = await Promise.all([
    ExamAttempt.exists({ studentId: userId, examId: { $in: examIds } }),
    ExamAssignment.exists({ studentId: userId, examId: { $in: examIds } }),
  ]);
  return Boolean(hasAttempt || hasAssignment);
}