import { Request, Response } from "express";
import { getMediaService } from "../services/mediaService";
import { ApiError, asyncHandler } from "../utils/helpers";
import { mimeToKind } from "../middleware/upload";

export const uploadFile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  if (!req.file) throw new ApiError(400, "No file provided");
  const kind = (req.body.kind as string) || mimeToKind(req.file.mimetype) || "DOCUMENT";
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