import { Request, Response } from "express";
import { ApiError, asyncHandler } from "../utils/helpers";
import * as chatService from "../services/chatService";

export const contacts = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await chatService.listContacts(req.user);
  res.json({ success: true, message: "Chat contacts", data });
});

export const messages = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await chatService.listMessages(req.user, String(req.params.contactId));
  res.json({ success: true, message: "Chat messages", data });
});

export const send = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await chatService.sendMessage(req.user, String(req.body.recipientId), String(req.body.body || ""));
  res.status(201).json({ success: true, message: "Message sent", data });
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  await chatService.markConversationRead(req.user, String(req.params.contactId));
  res.json({ success: true, message: "Conversation marked as read" });
});
