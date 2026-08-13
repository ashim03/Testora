import { Router } from "express";
import { z } from "zod";
import * as teacher from "../controllers/teacherController";
import { authenticate, authorize } from "../middleware/auth";
import { validateRequest } from "../middleware/error";
import {
  createStudentSchema,
  updateStudentSchema,
  createBatchSchema,
  updateBatchSchema,
} from "@testora-platform/shared";

const statusSchema = z.object({ status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]) });
const resetPasswordSchema = z.object({ password: z.string().min(8) });
const batchStudentsSchema = z.object({ studentIds: z.array(z.string()) });

const router = Router();
router.use(authenticate, authorize("TEACHER"));

router.get("/dashboard", teacher.dashboard);

router.get("/students", teacher.listStudents);
router.post("/students", validateRequest(createStudentSchema as never), teacher.createStudent);
router.get("/students/:id", teacher.getStudent);
router.patch("/students/:id", validateRequest(updateStudentSchema as never), teacher.updateStudent);
router.patch("/students/:id/status", validateRequest(statusSchema as never), teacher.setStudentStatus);
router.patch("/students/:id/reset-password", validateRequest(resetPasswordSchema as never), teacher.resetStudentPassword);

router.get("/batches", teacher.listBatches);
router.post("/batches", validateRequest(createBatchSchema as never), teacher.createBatch);
router.patch("/batches/:id", validateRequest(updateBatchSchema as never), teacher.updateBatch);
router.patch("/batches/:id/students", validateRequest(batchStudentsSchema as never), teacher.addStudentsToBatch);

router.get("/reports", teacher.reports);

export default router;