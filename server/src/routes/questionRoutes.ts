import { Router } from "express";
import * as questions from "../controllers/questionController";
import { authenticate, authorize } from "../middleware/auth";
import { validateRequest } from "../middleware/error";
import { createQuestionSchema, updateQuestionSchema, createPassageSchema, bulkDeleteQuestionsSchema } from "@testora-platform/shared";

const router = Router();
router.use(authenticate, authorize("SUPER_ADMIN", "TEACHER"));

router.get("/", questions.listQuestions);
router.post("/", validateRequest(createQuestionSchema as never), questions.createQuestion);
router.post("/bulk-delete", validateRequest(bulkDeleteQuestionsSchema as never), questions.bulkDeleteQuestions);
router.get("/passages", questions.listPassages);
router.post("/passages", validateRequest(createPassageSchema as never), questions.createPassage);
router.get("/:id", questions.getQuestion);
router.get("/:id/preview", questions.getQuestionPreview);
router.post("/:id/duplicate", questions.duplicateQuestion);
router.patch("/:id", validateRequest(updateQuestionSchema as never), questions.updateQuestion);
router.delete("/:id", questions.deleteQuestion);

export default router;