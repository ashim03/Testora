import { Request, Response } from "express";
import { ApiError, asyncHandler } from "../utils/helpers";
import * as speakingService from "../services/speakingService";

export const createAttempt = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  if (!req.file) throw new ApiError(400, "No audio file provided");
  const attempt = await speakingService.createSpeakingAttempt({
    studentId: req.user.id,
    taskType: req.body.taskType as never,
    title: (req.body.title as string) || "",
    prompt: (req.body.prompt as string) || "",
    reportedDurationSec: Number(req.body.durationSec || 0),
    buffer: req.file.buffer,
    declaredMime: req.file.mimetype,
    filename: req.file.originalname,
    keepAudio: String(req.body.keepAudio || "") === "true",
  });
  res.status(202).json({ success: true, message: "Speaking attempt accepted; processing started", data: speakingService.toSummary(attempt) });
});

export const listAttempts = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);
  const result = await speakingService.listSpeakingAttempts(req.user.id, page, limit);
  res.json({ success: true, message: "Speaking attempts", data: result.data, pagination: { page, limit, total: result.total, pages: result.pages } });
});

export const getAttempt = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await speakingService.getSpeakingAttempt(req.user.id, String(req.params.id));
  res.json({ success: true, message: "Speaking attempt", data });
});

export const retryAttempt = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await speakingService.retrySpeakingAttempt(req.user.id, String(req.params.id));
  res.status(202).json({ success: true, message: "Speaking attempt queued for reprocessing", data });
});

export const progress = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await speakingService.getSpeakingProgress(req.user.id);
  res.json({ success: true, message: "Speaking progress", data });
});