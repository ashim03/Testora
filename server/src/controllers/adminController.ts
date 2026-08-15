import { Request, Response } from "express";
import * as userService from "../services/userService";
import * as reportService from "../services/reportService";
import * as courseService from "../services/courseService";
import * as consultancyService from "../services/consultancyService";
import { ApiError, asyncHandler } from "../utils/helpers";

export const dashboard = asyncHandler(async (_req: Request, res: Response) => {
  const data = await reportService.adminDashboard();
  res.json({ success: true, message: "Admin dashboard", data });
});

export const listTeachers = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.listUsers("TEACHER", queryOf(req));
  res.json({ success: true, message: "Teachers", data: result.data, pagination: paginationOf(result) });
});

export const createTeacher = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await userService.createUser({ ...req.body, role: "TEACHER" }, req.user, req.ip || null);
  res.status(201).json({ success: true, message: "Teacher created", data });
});

export const getTeacher = asyncHandler(async (req: Request, res: Response) => {
  const data = await userService.getUserById(String(req.params.id), "TEACHER");
  res.json({ success: true, message: "Teacher", data });
});

export const updateTeacher = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await userService.updateUser(String(req.params.id), req.body, req.user, req.ip || null);
  res.json({ success: true, message: "Teacher updated", data });
});

export const setTeacherStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await userService.updateUserStatus(String(req.params.id), req.body.status, req.user, req.ip || null);
  res.json({ success: true, message: "Teacher status updated", data });
});

export const listStudents = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.listUsers("STUDENT", queryOf(req));
  res.json({ success: true, message: "Students", data: result.data, pagination: paginationOf(result) });
});

export const createStudent = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await userService.createUser({ ...req.body, role: "STUDENT" }, req.user, req.ip || null);
  res.status(201).json({ success: true, message: "Student created", data });
});

export const getStudent = asyncHandler(async (req: Request, res: Response) => {
  const data = await userService.getUserById(String(req.params.id), "STUDENT");
  res.json({ success: true, message: "Student", data });
});

export const updateStudent = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await userService.updateUser(String(req.params.id), req.body, req.user, req.ip || null);
  res.json({ success: true, message: "Student updated", data });
});

export const setStudentStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await userService.updateUserStatus(String(req.params.id), req.body.status, req.user, req.ip || null);
  res.json({ success: true, message: "Student status updated", data });
});

export const deleteStudent = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  await userService.softDeleteUser(String(req.params.id), req.user, req.ip || null);
  res.json({ success: true, message: "Student deleted" });
});

export const deleteTeacher = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  await userService.softDeleteUser(String(req.params.id), req.user, req.ip || null);
  res.json({ success: true, message: "Teacher deleted" });
});

export const resetTeacherPassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  await userService.resetPasswordByAdmin(String(req.params.id), req.body.password, req.user, req.ip || null);
  res.json({ success: true, message: "Password reset" });
});

export const resetStudentPassword = resetTeacherPassword;

export const assignStudents = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  await userService.assignStudentsToTeacher(req.body.studentIds, req.body.teacherId, req.user, req.ip || null);
  res.json({ success: true, message: "Students assigned" });
});

export const transferStudent = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  await userService.transferStudent(String(req.params.id), req.body.teacherId, req.user, req.ip || null);
  res.json({ success: true, message: "Student transferred" });
});

export const importStudents = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const file = req.file;
  if (!file) throw new ApiError(400, "CSV file required");
  const text = file.buffer.toString("utf-8");
  const rows = userService.parseCsv(text);
  const result = await userService.importStudentsCsv(rows, req.user, req.ip || null);
  res.json({ success: true, message: "Import complete", data: result });
});

export const exportStudents = asyncHandler(async (req: Request, res: Response) => {
  const students = await userService.listStudentsForExport();
  const csv = await userService.exportStudentsCsv(students);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=students.csv");
  res.send(csv);
});

export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const data = await reportService.listAuditLogs({ page: Number(req.query.page || 1), limit: Number(req.query.limit || 20), action: req.query.action as string | undefined });
  res.json({ success: true, message: "Audit logs", data });
});

export const listBatches = asyncHandler(async (_req: Request, res: Response) => {
  const data = await reportService.listBatchesForAdmin();
  res.json({ success: true, message: "Batches", data });
});

export const reports = asyncHandler(async (_req: Request, res: Response) => {
  const data = await reportService.adminReports();
  res.json({ success: true, message: "Admin reports", data });
});

export const myCourses = asyncHandler(async (_req: Request, res: Response) => {
  const data = await courseService.listCourses();
  res.json({ success: true, message: "Courses", data });
});

export const createCourse = asyncHandler(async (req: Request, res: Response) => {
  const data = await courseService.createCourse(req.body);
  res.status(201).json({ success: true, message: "Course created", data });
});

export const updateCourse = asyncHandler(async (req: Request, res: Response) => {
  const data = await courseService.updateCourse(String(req.params.id), req.body);
  res.json({ success: true, message: "Course updated", data });
});

export const deleteCourse = asyncHandler(async (req: Request, res: Response) => {
  const data = await courseService.deleteCourse(String(req.params.id));
  res.json({ success: true, message: "Course deleted", data });
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const data = await courseService.createCategory(req.body);
  res.status(201).json({ success: true, message: "Category created", data });
});

export const listCategories = asyncHandler(async (_req: Request, res: Response) => {
  const data = await courseService.listCategories();
  res.json({ success: true, message: "Categories", data });
});

export const listConsultancies = asyncHandler(async (req: Request, res: Response) => {
  const result = await consultancyService.listConsultancies(queryOf(req));
  res.json({ success: true, message: "Consultancies", data: result.data, pagination: paginationOf(result) });
});

export const createConsultancy = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await consultancyService.createConsultancy(req.body, req.user, req.ip || null);
  res.status(201).json({ success: true, message: "Consultancy created", data });
});

export const getConsultancy = asyncHandler(async (req: Request, res: Response) => {
  const data = await consultancyService.getConsultancy(String(req.params.id));
  res.json({ success: true, message: "Consultancy", data });
});

export const updateConsultancy = asyncHandler(async (req: Request, res: Response) => {
  const data = await consultancyService.updateConsultancy(String(req.params.id), req.body);
  res.json({ success: true, message: "Consultancy updated", data });
});

export const setConsultancyStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await consultancyService.setConsultancyStatus(String(req.params.id), req.body.status, req.user, req.ip || null);
  res.json({ success: true, message: "Consultancy status updated", data });
});

export const deleteConsultancy = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  await consultancyService.deleteConsultancy(String(req.params.id), req.user, req.ip || null);
  res.json({ success: true, message: "Consultancy deleted" });
});

export const listSubscriptionPackages = asyncHandler(async (req: Request, res: Response) => {
  const result = await consultancyService.listSubscriptionPackages({
    page: String(req.query.page || 1),
    limit: String(req.query.limit || 100),
    search: (req.query.search as string) || "",
    active: (req.query.active as string) || "",
  });
  res.json({ success: true, message: "Subscription packages", data: result.data, pagination: paginationOf(result) });
});

export const createSubscriptionPackage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await consultancyService.createSubscriptionPackage(req.body, req.user, req.ip || null);
  res.status(201).json({ success: true, message: "Subscription package created", data });
});

export const updateSubscriptionPackage = asyncHandler(async (req: Request, res: Response) => {
  const data = await consultancyService.updateSubscriptionPackage(String(req.params.id), req.body);
  res.json({ success: true, message: "Subscription package updated", data });
});

export const deleteSubscriptionPackage = asyncHandler(async (req: Request, res: Response) => {
  await consultancyService.deleteSubscriptionPackage(String(req.params.id));
  res.json({ success: true, message: "Subscription package deleted" });
});

export const assignPackage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await consultancyService.assignPackageToConsultancy(
    String(req.params.id),
    req.body.packageId,
    req.body.startDate,
    req.user,
    req.ip || null,
  );
  res.json({ success: true, message: "Subscription activated", data });
});

export const listSubscriptions = asyncHandler(async (_req: Request, res: Response) => {
  const data = await consultancyService.listSubscriptions();
  res.json({ success: true, message: "Subscriptions", data });
});

export const invoice = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const entryIndex = Number(req.params.index);
  if (!Number.isInteger(entryIndex) || entryIndex < 0) throw new ApiError(400, "Invalid ledger index");
  const invoice = await consultancyService.generateInvoice(String(req.params.id), entryIndex, req.user, req.ip || null);
  res.json({ success: true, message: "Invoice generated", data: invoice });
});

function queryOf(req: Request): Record<string, string> {
  return {
    page: String(req.query.page || 1),
    limit: String(req.query.limit || 10),
    search: (req.query.search as string) || "",
    sort: (req.query.sort as string) || "-createdAt",
    status: (req.query.status as string) || "",
    teacherId: (req.query.teacherId as string) || "",
    category: (req.query.category as string) || "",
  };
}

function paginationOf(result: { page: number; limit: number; total: number; pages: number }) {
  return { page: result.page, limit: result.limit, total: result.total, pages: result.pages };
}
