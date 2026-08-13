import { Request, Response } from "express";
import * as examService from "../services/examService";
import * as gradingService from "../services/gradingService";
import * as assignmentService from "../services/assignmentService";
import { ApiError, asyncHandler } from "../utils/helpers";

export const listExams = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const result = await examService.listExams(queryOf(req), req.user);
  res.json({ success: true, message: "Exams", data: result.data, pagination: { page: result.page, limit: result.limit, total: result.total, pages: result.pages } });
});

export const createExam = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await examService.createExam(req.body, req.user, req.ip || null);
  res.status(201).json({ success: true, message: "Exam created", data });
});

export const getExam = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await examService.getExamQuestions(String(req.params.id), req.user.id, req.user.role);
  res.json({ success: true, message: "Exam", data });
});

export const getExamForTeacher = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await examService.getExamForTeacher(String(req.params.id), req.user.id);
  res.json({ success: true, message: "Exam", data });
});

export const updateExam = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await examService.updateExam(String(req.params.id), req.body, req.user);
  res.json({ success: true, message: "Exam updated", data });
});

export const publishExam = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await examService.publishExam(String(req.params.id), req.user);
  res.json({ success: true, message: "Exam published", data });
});

export const archiveExam = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await examService.archiveExam(String(req.params.id), req.user);
  res.json({ success: true, message: "Exam archived", data });
});

export const assignExam = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const result = await examService.assignExam(String(req.params.id), { studentIds: req.body.studentIds, batchIds: req.body.batchIds }, req.user);
  res.json({ success: true, message: "Exam assigned", data: result });
});

export const listSubmissions = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const result = await examService.listTeacherSubmissions(req.user.id, queryOf(req));
  res.json({ success: true, message: "Submissions", data: result.data, pagination: { page: result.page, limit: result.limit, total: result.total, pages: result.pages } });
});

export const getSubmission = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await examService.getTeacherSubmission(String(req.params.id), req.user.id);
  res.json({ success: true, message: "Submission", data });
});

export const gradeSubmission = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await gradingService.gradeAttemptManually(String(req.params.id), req.body, req.user, req.ip || null);
  res.json({ success: true, message: "Graded", data });
});

export const publishResult = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await gradingService.publishResult(String(req.params.id), req.user, req.ip || null);
  res.json({ success: true, message: "Result published", data });
});

export const reopenAttempt = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await gradingService.reopenAttempt(String(req.params.id), req.user);
  res.json({ success: true, message: "Attempt reopened", data });
});

export const listResults = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await examService.listTeacherResults(req.user.id);
  res.json({ success: true, message: "Results", data });
});

export const listAssignments = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const result = await assignmentService.listAssignments(queryOf(req), req.user.id);
  res.json({ success: true, message: "Assignments", data: result.data, pagination: { page: result.page, limit: result.limit, total: result.total, pages: result.pages } });
});

export const createAssignment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await assignmentService.createAssignment(req.body, req.user, req.ip || null);
  res.status(201).json({ success: true, message: "Assignment created", data });
});

export const getAssignment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await assignmentService.getAssignment(String(req.params.id), req.user.id);
  res.json({ success: true, message: "Assignment", data });
});

export const updateAssignment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await assignmentService.updateAssignment(String(req.params.id), req.body, req.user);
  res.json({ success: true, message: "Assignment updated", data });
});

export const deleteAssignment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  await assignmentService.deleteAssignment(String(req.params.id), req.user);
  res.json({ success: true, message: "Assignment deleted" });
});

export const publishAssignment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await assignmentService.publishAssignment(String(req.params.id), req.user);
  res.json({ success: true, message: "Assignment published", data });
});

export const duplicateAssignment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await assignmentService.duplicateAssignment(String(req.params.id), req.user, req.body);
  res.status(201).json({ success: true, message: "Assignment duplicated", data });
});

export const listAssignmentSubmissions = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const assignmentId = (req.params.assignmentId as string | undefined) || "";
  const result = await assignmentService.listSubmission(assignmentId, queryOf(req), req.user.id);
  const d = result as { data: unknown; page: number; limit: number; total: number; pages: number };
  res.json({ success: true, message: "Assignment submissions", data: d.data, pagination: { page: d.page, limit: d.limit, total: d.total, pages: d.pages } });
});

export const gradeAssignmentSubmission = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await assignmentService.gradeSubmission(String(req.params.id), req.body, req.user.id);
  res.json({ success: true, message: "Submission graded", data });
});

function queryOf(req: Request) {
  return {
    page: Number(req.query.page || 1),
    limit: Number(req.query.limit || 10),
    search: (req.query.search as string) || "",
    sort: (req.query.sort as string) || "-createdAt",
    status: (req.query.status as string) || "",
    category: (req.query.category as string) || "",
  };
}