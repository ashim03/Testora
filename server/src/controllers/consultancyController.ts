import { Request, Response } from "express";
import { Types } from "mongoose";
import * as consultancyService from "../services/consultancyService";
import * as userService from "../services/userService";
import { User, TeacherStudentAssignment } from "../models";
import { ApiError, asyncHandler } from "../utils/helpers";

function consultancyIdOf(req: Request): string {
  if (!req.user?.consultancyId) throw new ApiError(403, "Not a consultancy account");
  return req.user.consultancyId;
}

async function assertSameConsultancy(actorConsultancyId: string, userId: string): Promise<void> {
  const target = await User.findOne({ _id: userId, deletedAt: null });
  if (!target) throw new ApiError(404, "User not found");
  if (String(target.consultancyId) !== actorConsultancyId) {
    throw new ApiError(403, "This user does not belong to your consultancy");
  }
}

export const overview = asyncHandler(async (req: Request, res: Response) => {
  const consultancy = await consultancyService.getConsultancyByUserId(String(req.user!.id));
  const [teachers, students, teacherCount, studentCount] = await Promise.all([
    consultancyService.listConsultancyUsers(consultancy.id, "TEACHER", { limit: 5 }),
    consultancyService.listConsultancyUsers(consultancy.id, "STUDENT", { limit: 5 }),
    User.countDocuments({ consultancyId: consultancy.id, role: "TEACHER", deletedAt: null }),
    User.countDocuments({ consultancyId: consultancy.id, role: "STUDENT", deletedAt: null }),
  ]);
  res.json({
    success: true,
    message: "Consultancy overview",
    data: {
      consultancy,
      counts: { teachers: teacherCount, students: studentCount },
      recentTeachers: teachers.data,
      recentStudents: students.data,
    },
  });
});

export const listTeachers = asyncHandler(async (req: Request, res: Response) => {
  const result = await consultancyService.listConsultancyUsers(consultancyIdOf(req), "TEACHER", {
    page: String(req.query.page || 1),
    limit: String(req.query.limit || 10),
    search: (req.query.search as string) || "",
    sort: (req.query.sort as string) || "-createdAt",
    status: (req.query.status as string) || "",
  });
  res.json({ success: true, message: "Teachers", data: result.data, pagination: { page: result.page, limit: result.limit, total: result.total, pages: result.pages } });
});

export const createTeacher = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await consultancyService.createConsultancyUser(
    consultancyIdOf(req),
    { ...req.body, role: "TEACHER" },
    req.user,
    req.ip || null,
  );
  res.status(201).json({ success: true, message: "Teacher created", data });
});

export const updateTeacher = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  await assertSameConsultancy(consultancyIdOf(req), String(req.params.id));
  const data = await userService.updateUser(String(req.params.id), req.body, req.user, req.ip || null);
  res.json({ success: true, message: "Teacher updated", data });
});

export const setTeacherStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  await assertSameConsultancy(consultancyIdOf(req), String(req.params.id));
  const data = await userService.updateUserStatus(String(req.params.id), req.body.status, req.user, req.ip || null);
  res.json({ success: true, message: "Teacher status updated", data });
});

export const resetTeacherPassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  await assertSameConsultancy(consultancyIdOf(req), String(req.params.id));
  await userService.resetPasswordByAdmin(String(req.params.id), req.body.password, req.user, req.ip || null);
  res.json({ success: true, message: "Password reset" });
});

export const deleteTeacher = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  await assertSameConsultancy(consultancyIdOf(req), String(req.params.id));
  await userService.softDeleteUser(String(req.params.id), req.user, req.ip || null);
  res.json({ success: true, message: "Teacher deleted" });
});

export const listStudents = asyncHandler(async (req: Request, res: Response) => {
  const result = await consultancyService.listConsultancyUsers(consultancyIdOf(req), "STUDENT", {
    page: String(req.query.page || 1),
    limit: String(req.query.limit || 10),
    search: (req.query.search as string) || "",
    sort: (req.query.sort as string) || "-createdAt",
    status: (req.query.status as string) || "",
    teacherId: (req.query.teacherId as string) || "",
  });
  res.json({ success: true, message: "Students", data: result.data, pagination: { page: result.page, limit: result.limit, total: result.total, pages: result.pages } });
});

export const createStudent = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await consultancyService.createConsultancyUser(
    consultancyIdOf(req),
    { ...req.body, role: "STUDENT" },
    req.user,
    req.ip || null,
  );
  res.status(201).json({ success: true, message: "Student created", data });
});

export const updateStudent = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  await assertSameConsultancy(consultancyIdOf(req), String(req.params.id));
  const data = await userService.updateUser(String(req.params.id), req.body, req.user, req.ip || null);
  res.json({ success: true, message: "Student updated", data });
});

export const setStudentStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  await assertSameConsultancy(consultancyIdOf(req), String(req.params.id));
  const data = await userService.updateUserStatus(String(req.params.id), req.body.status, req.user, req.ip || null);
  res.json({ success: true, message: "Student status updated", data });
});

export const resetStudentPassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  await assertSameConsultancy(consultancyIdOf(req), String(req.params.id));
  await userService.resetPasswordByAdmin(String(req.params.id), req.body.password, req.user, req.ip || null);
  res.json({ success: true, message: "Password reset" });
});

export const deleteStudent = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  await assertSameConsultancy(consultancyIdOf(req), String(req.params.id));
  await userService.softDeleteUser(String(req.params.id), req.user, req.ip || null);
  res.json({ success: true, message: "Student deleted" });
});

export const subscription = asyncHandler(async (req: Request, res: Response) => {
  const consultancy = await consultancyService.getConsultancyByUserId(String(req.user!.id));
  const packages = await consultancyService.listSubscriptionPackages({ active: "true" });
  res.json({ success: true, message: "Subscription", data: { consultancy, packages: packages.data } });
});

export const assignStudentTeacher = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const consultancyId = consultancyIdOf(req);
  const { studentIds, teacherId } = req.body as { studentIds: string[]; teacherId: string };
  await assertSameConsultancy(consultancyId, teacherId);
  for (const sid of studentIds) {
    await assertSameConsultancy(consultancyId, sid);
  }
  await userService.assignStudentsToTeacher(studentIds, teacherId, req.user, req.ip || null);
  res.json({ success: true, message: "Students assigned" });
});

export const teacherList = asyncHandler(async (req: Request, res: Response) => {
  const teachers = await consultancyService.listConsultancyUsers(consultancyIdOf(req), "TEACHER", { limit: 100 });
  const ids = (teachers.data as Array<{ id: string }>).map((t) => new Types.ObjectId(t.id));
  const assignments = await TeacherStudentAssignment.countDocuments({
    teacherId: { $in: ids },
    status: "ACTIVE",
    endedAt: null,
  });
  res.json({ success: true, message: "Teachers", data: { teachers: teachers.data, totalActiveAssignments: assignments } });
});

export const contentOverview = asyncHandler(async (req: Request, res: Response) => {
  const data = await consultancyService.consultancyContentOverview(consultancyIdOf(req));
  res.json({ success: true, message: "Content overview", data });
});

export const listCourses = asyncHandler(async (req: Request, res: Response) => {
  const result = await consultancyService.listConsultancyCourses(consultancyIdOf(req), {
    page: String(req.query.page || ""),
    limit: String(req.query.limit || ""),
    search: String(req.query.search || ""),
    type: String(req.query.type || ""),
    active: String(req.query.active || ""),
  });
  const d = result as { data: unknown; total: number; page: number; limit: number; pages: number };
  res.json({ success: true, message: "Courses", data: d.data, pagination: { page: d.page, limit: d.limit, total: d.total, pages: d.pages } });
});

export const listExams = asyncHandler(async (req: Request, res: Response) => {
  const result = await consultancyService.listConsultancyExams(consultancyIdOf(req), {
    page: String(req.query.page || ""),
    limit: String(req.query.limit || ""),
    search: String(req.query.search || ""),
    type: String(req.query.type || ""),
    category: String(req.query.category || ""),
    status: String(req.query.status || ""),
  });
  const d = result as { data: unknown; total: number; page: number; limit: number; pages: number };
  res.json({ success: true, message: "Exams", data: d.data, pagination: { page: d.page, limit: d.limit, total: d.total, pages: d.pages } });
});
