import { Question, Passage } from "../models";
import { ApiError, parseSort } from "../utils/helpers";
import { logActivity } from "./notificationService";
import { verifyTeacherOwnership } from "./userService";

export interface QuestionQuery {
  page: number;
  limit: number;
  search?: string;
  sort?: string;
  category?: string;
  type?: string;
  difficulty?: string;
  ownerId?: string;
}

export async function createQuestion(
  data: Record<string, unknown>,
  actor: { id: string; role: string },
  ip?: string | null,
): Promise<unknown> {
  const question = await Question.create({
    ...data,
    createdBy: actor.id,
    deletedAt: null,
  });
  await logActivity(actor.id, "CREATE_QUESTION", "Question", question._id, {}, ip);
  return question;
}

export async function listQuestions(query: QuestionQuery): Promise<{
  data: unknown[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}> {
  const page = query.page || 1;
  const limit = query.limit || 10;
  const filter: Record<string, unknown> = { deletedAt: null };
  if (query.category) filter.category = query.category;
  if (query.type) filter.type = query.type;
  if (query.difficulty) filter.difficulty = query.difficulty;
  if (query.ownerId) filter.createdBy = query.ownerId;
  if (query.search) {
    const re = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ title: re }, { tags: re }];
  }
  const sort = parseSort(query.sort || "-createdAt", ["createdAt", "title", "marks", "difficulty"]);
  const total = await Question.countDocuments(filter);
  const data = await Question.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).populate("passageId", "title");
  return { data, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getQuestion(id: string): Promise<unknown> {
  const question = await Question.findOne({ _id: id, deletedAt: null }).populate("passageId");
  if (!question) throw new ApiError(404, "Question not found");
  return question;
}

export async function updateQuestion(id: string, data: Record<string, unknown>, actor: { id: string; role: string }): Promise<unknown> {
  const question = await Question.findOne({ _id: id, deletedAt: null });
  if (!question) throw new ApiError(404, "Question not found");
  if (question.createdBy.toString() !== String(actor.id)) {
    throw new ApiError(403, "You can only edit your own questions");
  }
  Object.assign(question, data);
  await question.save();
  return question;
}

export async function deleteQuestion(id: string, actor: { id: string; role: string }): Promise<void> {
  const question = await Question.findOne({ _id: id, deletedAt: null });
  if (!question) throw new ApiError(404, "Question not found");
  if (String(question.createdBy) !== actor.id) {
    throw new ApiError(403, "You can only delete your own questions");
  }
  question.deletedAt = new Date();
  await question.save();
}

export async function createPassage(data: Record<string, unknown>, actorId: string): Promise<unknown> {
  return Passage.create({ ...data, createdBy: actorId });
}

export async function listPassages(query: { page?: number; limit?: number; search?: string }): Promise<unknown[]> {
  const filter: Record<string, unknown> = {};
  if (query.search) {
    const re = new RegExp(query.search, "i");
    filter.$or = [{ title: re }, { tags: re }];
  }
  return Passage.find(filter).limit(query.limit || 50).sort({ createdAt: -1 }).lean();
}

export const isQuestionOwnedByTeacher = verifyTeacherOwnership;