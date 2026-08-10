import { Router } from "express";
import * as notifications from "../controllers/notificationController";
import { authenticate } from "../middleware/auth";

const router = Router();
router.use(authenticate);

router.get("/", notifications.listNotifications);
router.patch("/:id/read", notifications.markRead);
router.post("/read-all", notifications.markAllRead);

export default router;
