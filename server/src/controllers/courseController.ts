import { Request, Response } from "express";
import * as courseContent from "../services/courseContentService";
import { ApiError, asyncHandler } from "../utils/helpers";

const pageOf = (req: Request) => Number(req.query.page || 1);
const limitOf = (req: Request) => Number(req.query.limit || 10);

export const listMyCourses = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const result = await courseContent.listCoursesForTeacher(req.user.id, {
    page: pageOf(req),
    limit: limitOf(req),
    search: (req.query.search as string) || "",
    sort: (req.query.sort as string) || "",
    status: (req.query.status as string) || "",
  });
  res.json({ success: true, message: "Courses", data: result.data, pagination: { page: result.page, limit: result.limit, total: result.total, pages: result.pages } });
});

export const getCourse = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await courseContent.getCourseFull(String(req.params.courseId), req.user.role, req.user.id);
  res.json({ success: true, message: "Course", data });
});

export const getCourseOutline = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await courseContent.getCourseOutline(String(req.params.courseId), req.user.role, req.user.id);
  res.json({ success: true, message: "Course outline", data });
});

export const createModule = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await courseContent.createModule(String(req.params.courseId), req.body, { id: req.user.id, role: req.user.role });
  res.status(201).json({ success: true, message: "Module created", data });
});

export const updateModule = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await courseContent.updateModule(String(req.params.moduleId), req.body, { id: req.user.id, role: req.user.role });
  res.json({ success: true, message: "Module updated", data });
});

export const deleteModule = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  await courseContent.deleteModule(String(req.params.moduleId), { id: req.user.id, role: req.user.role });
  res.json({ success: true, message: "Module deleted" });
});

export const createChapter = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await courseContent.createChapter(String(req.params.moduleId), req.body, { id: req.user.id, role: req.user.role });
  res.status(201).json({ success: true, message: "Chapter created", data });
});

export const updateChapter = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await courseContent.updateChapter(String(req.params.chapterId), req.body, { id: req.user.id, role: req.user.role });
  res.json({ success: true, message: "Chapter updated", data });
});

export const deleteChapter = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  await courseContent.deleteChapter(String(req.params.chapterId), { id: req.user.id, role: req.user.role });
  res.json({ success: true, message: "Chapter deleted" });
});

export const createLesson = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await courseContent.createLesson(String(req.params.chapterId), req.body, { id: req.user.id, role: req.user.role });
  res.status(201).json({ success: true, message: "Lesson created", data });
});

export const updateLesson = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await courseContent.updateLesson(String(req.params.lessonId), req.body, { id: req.user.id, role: req.user.role });
  res.json({ success: true, message: "Lesson updated", data });
});

export const deleteLesson = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  await courseContent.deleteLesson(String(req.params.lessonId), { id: req.user.id, role: req.user.role });
  res.json({ success: true, message: "Lesson deleted" });
});

export const reorderLessons = asyncHandler(async (req: Request, res: Response) => {
  await courseContent.reorderLessons(req.body.lessonIds || []);
  res.json({ success: true, message: "Lessons reordered" });
});

export const createMaterial = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const lessonId = req.params.lessonId ? String(req.params.lessonId) : null;
  const data = await courseContent.createMaterial(lessonId, req.body, { id: req.user.id, role: req.user.role });
  res.status(201).json({ success: true, message: "Material created", data });
});

export const updateMaterial = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await courseContent.updateMaterial(String(req.params.materialId), req.body, { id: req.user.id, role: req.user.role });
  res.json({ success: true, message: "Material updated", data });
});

export const deleteMaterial = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  await courseContent.deleteMaterial(String(req.params.materialId), { id: req.user.id, role: req.user.role });
  res.json({ success: true, message: "Material deleted" });
});

export const createAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await courseContent.createAnnouncement(String(req.params.courseId), req.body, { id: req.user.id, role: req.user.role });
  res.status(201).json({ success: true, message: "Announcement created", data });
});

export const listAnnouncements = asyncHandler(async (req: Request, res: Response) => {
  const data = await courseContent.listAnnouncements(String(req.params.courseId));
  res.json({ success: true, message: "Announcements", data });
});

export const deleteAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  await courseContent.deleteAnnouncement(String(req.params.announcementId), { id: req.user.id, role: req.user.role });
  res.json({ success: true, message: "Announcement deleted" });
});

export const enrollStudents = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await courseContent.enrollStudents(String(req.params.courseId), { studentIds: req.body.studentIds, batchIds: req.body.batchIds }, { id: req.user.id, role: req.user.role });
  res.json({ success: true, message: "Students enrolled", data });
});

export const listEnrollments = asyncHandler(async (req: Request, res: Response) => {
  const data = await courseContent.listEnrollments(String(req.params.courseId), { page: pageOf(req), limit: limitOf(req), search: (req.query.search as string) || "", status: (req.query.status as string) || "" });
  res.json({ success: true, message: "Enrollments", data });
});

export const dropStudent = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  await courseContent.dropStudent(String(req.params.courseId), String(req.params.studentId), { id: req.user.id, role: req.user.role });
  res.json({ success: true, message: "Student dropped" });
});

export const listMyCoursesStudent = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await courseContent.listStudentCourses(req.user.id);
  res.json({ success: true, message: "My courses", data });
});

export const getStudentCourse = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await courseContent.getStudentCourseContent(String(req.params.courseId), req.user.id);
  res.json({ success: true, message: "Course content", data });
});

export const markLessonComplete = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await courseContent.markLessonComplete(String(req.params.courseId), String(req.params.lessonId), req.user.id, req.body.source);
  res.json({ success: true, message: "Lesson marked complete", data });
});

export const recordMaterialView = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const lessonId = req.params.lessonId ? String(req.params.lessonId) : null;
  await courseContent.recordMaterialView(String(req.params.courseId), lessonId, String(req.params.materialId), req.user.id);
  res.json({ success: true, message: "Material viewed" });
});
