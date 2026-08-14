import { Router } from "express";
import { z } from "zod";
import * as consultancy from "../controllers/consultancyController";
import { authenticate, authorize } from "../middleware/auth";
import { validateRequest } from "../middleware/error";
import { addConsultancyUserSchema } from "@testora-platform/shared";

const statusSchema = z.object({ status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]) });
const resetPasswordSchema = z.object({ password: z.string().min(8) });
const assignStudentsSchema = z.object({
  studentIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id")).min(1),
  teacherId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id"),
});
const updateUserSchema = z.object({
  firstName: z.string().trim().min(2).max(60).optional(),
  lastName: z.string().trim().min(2).max(60).optional(),
  phone: z.string().trim().max(30).optional().nullable(),
  qualification: z.string().max(300).optional(),
  teacherId: z.string().optional().nullable(),
  batchId: z.string().optional().nullable(),
});

const router = Router();
router.use(authenticate, authorize("CONSULTANCY"));

router.get("/overview", consultancy.overview);
router.get("/subscription", consultancy.subscription);
router.get("/teachers", consultancy.listTeachers);
router.get("/teachers/all", consultancy.teacherList);
router.post("/teachers", validateRequest(addConsultancyUserSchema as never), consultancy.createTeacher);
router.patch("/teachers/:id", validateRequest(updateUserSchema as never), consultancy.updateTeacher);
router.patch("/teachers/:id/status", validateRequest(statusSchema as never), consultancy.setTeacherStatus);
router.patch("/teachers/:id/reset-password", validateRequest(resetPasswordSchema as never), consultancy.resetTeacherPassword);
router.delete("/teachers/:id", consultancy.deleteTeacher);

router.get("/students", consultancy.listStudents);
router.post("/students", validateRequest(addConsultancyUserSchema as never), consultancy.createStudent);
router.patch("/students/:id", validateRequest(updateUserSchema as never), consultancy.updateStudent);
router.patch("/students/:id/status", validateRequest(statusSchema as never), consultancy.setStudentStatus);
router.patch("/students/:id/reset-password", validateRequest(resetPasswordSchema as never), consultancy.resetStudentPassword);
router.delete("/students/:id", consultancy.deleteStudent);
router.post("/students/assign", validateRequest(assignStudentsSchema as never), consultancy.assignStudentTeacher);

export default router;
