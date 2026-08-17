import { Router } from "express";
import multer from "multer";
import { createSpeakingAttemptSchema } from "@testora-platform/shared";
import * as speaking from "../controllers/speakingController";
import { authenticate, authorize } from "../middleware/auth";
import { validateRequest } from "../middleware/error";
import { speakingLimiter } from "../middleware/rateLimit";
import { config } from "../config";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(config.speaking.maxSizeMb, 1) * 1024 * 1024, files: 1 },
}).single("file");

const router = Router();
router.use(authenticate, authorize("STUDENT"));

router.post("/attempts", speakingLimiter, upload, validateRequest(createSpeakingAttemptSchema as never), speaking.createAttempt);
router.get("/attempts", speaking.listAttempts);
router.get("/attempts/progress", speaking.progress);
router.get("/attempts/:id", speaking.getAttempt);
router.post("/attempts/:id/retry", speakingLimiter, speaking.retryAttempt);

export default router;