import { Request, Response } from "express";
import * as studentService from "../services/studentService";
import { ApiError, asyncHandler } from "../utils/helpers";

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const result = await studentService.studentNotifications(req.user.id, { page: Number(req.query.page || 1), limit: Number(req.query.limit || 10) });
  const d = result as { data: unknown; page: number; limit: number; total: number; pages: number; unread: number };
  res.json({
    success: true,
    message: "Notifications",
    data: d.data,
    pagination: { page: d.page, limit: d.limit, total: d.total, pages: d.pages },
    unread: d.unread,
  });
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  await studentService.markNotificationRead(String(req.params.id), req.user.id);
  res.json({ success: true, message: "Marked read" });
});

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  await studentService.markAllNotificationsRead(req.user.id);
  res.json({ success: true, message: "All notifications read" });
});
