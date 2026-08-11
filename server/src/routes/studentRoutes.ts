import { Router } from "express";
import { z } from "zod";
import * as student from "../controllers/studentController";
import { authenticate, authorize } from "../middleware/auth";
import { validateRequest } from "../middleware/error";
import { submitLimiter } from "../middleware/rateLimit";
import { integrityEventSchema, subscribeSchema } from "@ielts-pte-platform/shared";

const answersSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string(),
      answer: z.any(),
      answered: z.boolean().optional(),
    }),
  ),
});

const router = Router();
router.use(authenticate, authorize("STUDENT"));

router.get("/dashboard", student.dashboard);

router.get("/subscription", student.getSubscription);
router.post("/subscription", validateRequest(subscribeSchema as never), student.subscribe);
router.post("/subscription/cancel", student.cancelSubscription);

router.get("/exams", student.listExams);
router.get("/practice", student.listPracticeExams);
  router.get("/practice/summary", student.sectionalSummary);
router.get("/exams/:id", student.getExam);
router.post("/exams/:id/start", student.startExam);
router.get("/attempts/:id", student.getAttempt);
router.patch("/attempts/:id/answers", validateRequest(answersSchema as never), student.saveAnswers);
router.post("/attempts/:id/integrity-event", validateRequest(integrityEventSchema as never), student.integrityEvent);
router.post("/attempts/:id/submit", submitLimiter, student.submitAttempt);

router.get("/assignments", student.listAssignments);
router.get("/assignments/:id", student.getAssignment);
router.post("/assignments/:id/submit", submitLimiter, student.submitAssignment);

router.get("/results", student.listResults);
router.get("/results/:id", student.getResult);
router.get("/progress", student.progress);
router.get("/feedback", student.feedback);

router.get("/notifications", student.listNotifications);
router.patch("/notifications/:id/read", student.markRead);
router.post("/notifications/read-all", student.markAllRead);

export default router;