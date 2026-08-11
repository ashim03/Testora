import { Router } from "express";
import { z } from "zod";
import * as chat from "../controllers/chatController";
import { authenticate, authorize } from "../middleware/auth";
import { validateRequest } from "../middleware/error";

const sendMessageSchema = z.object({
  recipientId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid recipient"),
  body: z.string().trim().min(1, "Message cannot be empty").max(2000, "Message is too long"),
});

const router = Router();
router.use(authenticate, authorize("SUPER_ADMIN", "TEACHER", "STUDENT"));

router.get("/contacts", chat.contacts);
router.get("/messages/:contactId", chat.messages);
router.post("/messages", validateRequest(sendMessageSchema as never), chat.send);
router.patch("/messages/:contactId/read", chat.markRead);

export default router;
