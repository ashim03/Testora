import { Router } from "express";
import { z } from "zod";
import * as admin from "../controllers/adminController";
import { authenticate, authorize } from "../middleware/auth";
import { validateRequest } from "../middleware/error";
import { uploadDocSingle } from "../middleware/upload";
import {
  createTeacherSchema,
  updateTeacherSchema,
  createStudentSchema,
  updateStudentSchema,
  assignStudentSchema,
  transferStudentSchema,
  createCourseSchema,
  categorySchema,
} from "@ielts-pte-platform/shared";

const statusSchema = z.object({ status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]) });
const resetPasswordSchema = z.object({ password: z.string().min(8) });

const router = Router();
router.use(authenticate, authorize("SUPER_ADMIN"));

router.get("/dashboard", admin.dashboard);

router.get("/teachers", admin.listTeachers);
router.post("/teachers", validateRequest(createTeacherSchema as never), admin.createTeacher);
router.get("/teachers/:id", admin.getTeacher);
router.patch("/teachers/:id", validateRequest(updateTeacherSchema as never), admin.updateTeacher);
router.patch("/teachers/:id/status", validateRequest(statusSchema as never), admin.setTeacherStatus);
router.patch("/teachers/:id/reset-password", validateRequest(resetPasswordSchema as never), admin.resetTeacherPassword);
router.delete("/teachers/:id", admin.deleteTeacher);

router.get("/students", admin.listStudents);
router.post("/students", validateRequest(createStudentSchema as never), admin.createStudent);
router.post("/students/import", uploadDocSingle, admin.importStudents);
router.get("/students/export", admin.exportStudents);
router.get("/students/:id", admin.getStudent);
router.patch("/students/:id", validateRequest(updateStudentSchema as never), admin.updateStudent);
router.patch("/students/:id/status", validateRequest(statusSchema as never), admin.setStudentStatus);
router.patch("/students/:id/reset-password", validateRequest(resetPasswordSchema as never), admin.resetStudentPassword);
router.delete("/students/:id", admin.deleteStudent);
router.post("/student-assignments", validateRequest(assignStudentSchema as never), admin.assignStudents);
router.patch("/student-assignments/:id", validateRequest(transferStudentSchema as never), admin.transferStudent);

router.get("/courses", admin.myCourses);
router.post("/courses", validateRequest(createCourseSchema as never), admin.createCourse);
router.get("/categories", admin.listCategories);
router.post("/categories", validateRequest(categorySchema as never), admin.createCategory);

router.get("/batches", admin.listBatches);
router.get("/audit-logs", admin.listAuditLogs);
router.get("/reports", admin.reports);

export default router;
