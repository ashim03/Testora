import { Request, Response } from "express";
import * as userService from "../services/userService";
import * as teacherService from "../services/teacherService";
import * as reportService from "../services/reportService";
import { ApiError, asyncHandler } from "../utils/helpers";
import { studentIdsOfTeacher } from "../services/userService";

export const dashboard = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await teacherService.teacherDashboard(req.user.id);
  res.json({ success: true, message: "Teacher dashboard", data });
});

export const listStudents = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const ids = await studentIdsOfTeacher(req.user.id);
  const result = await userService.listUsers("STUDENT", queryOf(req), { teacherId: req.user.id });
  const data = result.data.map((s) => {
    const r = s as { id: string };
    return { ...(s as Record<string, unknown>), accessible: ids.some((i) => String(i) === r.id) };
  });
  res.json({ success: true, message: "My students", data, pagination: { page: result.page, limit: result.limit, total: result.total, pages: result.pages } });
});

export const getStudent = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const accessible = await isStudentAccessible(req.user.id, String(req.params.id));
  if (!accessible) throw new ApiError(403, "You do not have access to this student");
  const data = await userService.getUserById(String(req.params.id), "STUDENT");
  res.json({ success: true, message: "Student", data });
});

export const createStudent = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await userService.createUser({ ...req.body, role: "STUDENT", teacherId: req.user.id }, { id: req.user.id, role: req.user.role }, req.ip || null);
  res.status(201).json({ success: true, message: "Student created", data });
});

export const updateStudent = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const accessible = await isStudentAccessible(req.user.id, String(req.params.id));
  if (!accessible) throw new ApiError(403, "You do not have access to this student");
  const data = await userService.updateUser(String(req.params.id), req.body, { id: req.user.id, role: req.user.role }, req.ip || null);
  res.json({ success: true, message: "Student updated", data });
});

export const setStudentStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const accessible = await isStudentAccessible(req.user.id, String(req.params.id));
  if (!accessible) throw new ApiError(403, "You do not have access to this student");
  const data = await userService.updateUserStatus(String(req.params.id), req.body.status, { id: req.user.id, role: req.user.role }, req.ip || null);
  res.json({ success: true, message: "Student status updated", data });
});

export const resetStudentPassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const accessible = await isStudentAccessible(req.user.id, String(req.params.id));
  if (!accessible) throw new ApiError(403, "You do not have access to this student");
  await userService.resetPasswordByAdmin(String(req.params.id), req.body.password, { id: req.user.id, role: req.user.role }, req.ip || null);
  res.json({ success: true, message: "Password reset" });
});

export const listBatches = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await teacherService.listBatches(req.user.id, req.query.courseType as string | undefined);
  res.json({ success: true, message: "Batches", data });
});

export const createBatch = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await teacherService.createBatch(req.body, req.user.id);
  res.status(201).json({ success: true, message: "Batch created", data });
});

export const updateBatch = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await teacherService.updateBatch(String(req.params.id), req.body, req.user.id);
  res.json({ success: true, message: "Batch updated", data });
});

export const addStudentsToBatch = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  await teacherService.addStudentsToBatch(String(req.params.id), req.body.studentIds);
  res.json({ success: true, message: "Students added to batch" });
});

export const reports = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await reportService.teacherReport(req.user.id);
  res.json({ success: true, message: "Teacher report", data });
});

async function isStudentAccessible(teacherId: string, studentId: string): Promise<boolean> {
  return userService.verifyTeacherOwnership(teacherId, studentId);
}

function queryOf(req: Request): Record<string, string> {
  return {
    page: String(req.query.page || 1),
    limit: String(req.query.limit || 10),
    search: (req.query.search as string) || "",
    sort: (req.query.sort as string) || "-createdAt",
    status: (req.query.status as string) || "",
  };
}