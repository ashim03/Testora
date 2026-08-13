import { Router } from "express";
import * as exams from "../controllers/examController";
import { authenticate, authorize } from "../middleware/auth";
import { validateRequest } from "../middleware/error";
import {
  createExamSchema,
  updateExamSchema,
  assignExamSchema,
  gradeSubmissionSchema,
} from "@testora-platform/shared";

const router = Router();
router.use(authenticate, authorize("SUPER_ADMIN", "TEACHER"));

router.get("/", exams.listExams);
router.post("/", validateRequest(createExamSchema as never), exams.createExam);
router.get("/submissions", exams.listSubmissions);
router.get("/submissions/:id", exams.getSubmission);
router.post("/submissions/:id/grade", validateRequest(gradeSubmissionSchema as never), exams.gradeSubmission);
router.post("/submissions/:id/publish", exams.publishResult);
router.post("/submissions/:id/reopen", exams.reopenAttempt);
router.get("/results", exams.listResults);
router.get("/assignments", exams.listAssignments);
router.post("/assignments", exams.createAssignment);
router.get("/assignments/:id", exams.getAssignment);
router.patch("/assignments/:id", exams.updateAssignment);
router.delete("/assignments/:id", exams.deleteAssignment);
router.post("/assignments/:id/publish", exams.publishAssignment);
router.get("/assignments/:assignmentId/submissions", exams.listAssignmentSubmissions);
router.get("/assignment-submissions", exams.listAssignmentSubmissions);
router.post("/assignment-submissions/:id/grade", exams.gradeAssignmentSubmission);
router.get("/teacher/:id", exams.getExamForTeacher);
router.get("/:id", exams.getExam);
router.patch("/:id", validateRequest(updateExamSchema as never), exams.updateExam);
router.post("/:id/publish", exams.publishExam);
router.post("/:id/archive", exams.archiveExam);
router.post("/:id/assign", validateRequest(assignExamSchema as never), exams.assignExam);

export default router;