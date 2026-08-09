import { Request, Response } from "express";
import * as brandingService from "../services/brandingService";
import { ApiError, asyncHandler } from "../utils/helpers";

export const getActive = asyncHandler(async (_req: Request, res: Response) => {
  const branding = await brandingService.getActiveBranding();
  res.json({ success: true, message: "Branding", data: branding });
});

export const getMine = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const branding = await brandingService.getBrandingForUser(req.user.id);
  res.json({ success: true, message: "Your branding", data: branding });
});

export const put = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const branding = await brandingService.setBranding(req.user.id, req.body, req.user, req.ip);
  res.json({ success: true, message: "Branding updated", data: branding });
});

export const clearLogo = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const branding = await brandingService.clearLogo(req.user.id);
  res.json({ success: true, message: "Logo removed", data: branding });
});