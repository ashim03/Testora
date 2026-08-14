import { Request, Response } from "express";
import * as questionService from "../services/questionService";
import { ApiError, asyncHandler } from "../utils/helpers";

export const listQuestions = asyncHandler(async (req: Request, res: Response) => {
  const result = await questionService.listQuestions(queryOf(req));
  res.json({ success: true, message: "Questions", data: result.data, pagination: { page: result.page, limit: result.limit, total: result.total, pages: result.pages } });
});

export const createQuestion = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await questionService.createQuestion(req.body, req.user, req.ip || null);
  res.status(201).json({ success: true, message: "Question created", data });
});

export const getQuestion = asyncHandler(async (req: Request, res: Response) => {
  const data = await questionService.getQuestion(String(req.params.id));
  res.json({ success: true, message: "Question", data });
});

export const updateQuestion = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await questionService.updateQuestion(String(req.params.id), req.body, req.user);
  res.json({ success: true, message: "Question updated", data });
});

export const deleteQuestion = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  await questionService.deleteQuestion(String(req.params.id), req.user);
  res.json({ success: true, message: "Question deleted" });
});

export const bulkDeleteQuestions = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const deleted = await questionService.bulkDeleteQuestions((req.body.ids as string[]) || [], req.user);
  res.json({ success: true, message: `${deleted} question${deleted === 1 ? "" : "s"} deleted`, data: { deleted } });
});

export const duplicateQuestion = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await questionService.duplicateQuestion(String(req.params.id), req.user);
  res.status(201).json({ success: true, message: "Question duplicated", data });
});

export const getQuestionPreview = asyncHandler(async (req: Request, res: Response) => {
  const data = await questionService.getQuestionPreview(String(req.params.id));
  res.json({ success: true, message: "Question preview", data });
});

export const listPassages = asyncHandler(async (req: Request, res: Response) => {
  const data = await questionService.listPassages({ search: req.query.search as string | undefined });
  res.json({ success: true, message: "Passages", data });
});

export const createPassage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const data = await questionService.createPassage(req.body, req.user.id);
  res.status(201).json({ success: true, message: "Passage created", data });
});

function queryOf(req: Request) {
  return {
    page: Number(req.query.page || 1),
    limit: Number(req.query.limit || 10),
    search: (req.query.search as string) || "",
    sort: (req.query.sort as string) || "-createdAt",
    category: (req.query.category as string) || "",
    type: (req.query.type as string) || "",
    difficulty: (req.query.difficulty as string) || "",
    ownerId: (req.query.ownerId as string) || "",
    courseId: (req.query.courseId as string) || "",
    moduleId: (req.query.moduleId as string) || "",
    chapterId: (req.query.chapterId as string) || "",
    topic: (req.query.topic as string) || "",
  };
}