import { Question, Passage, MediaAsset } from "../models";
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
  courseId?: string;
  moduleId?: string;
  chapterId?: string;
  topic?: string;
}

export async function createQuestion(
  data: Record<string, unknown>,
  actor: { id: string; role: string },
  ip?: string | null,
): Promise<unknown> {
  await assertAudioOwnership(data, actor);
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
  if (query.courseId) filter.courseId = query.courseId;
  if (query.moduleId) filter.moduleId = query.moduleId;
  if (query.chapterId) filter.chapterId = query.chapterId;
  if (query.topic) {
    const re = new RegExp(query.topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.topic = re;
  }
  if (query.search) {
    const re = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ title: re }, { tags: re }, { topic: re }];
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
  await assertAudioOwnership(data, actor);
  Object.assign(question, data);
  await question.save();
  return question;
}

async function assertAudioOwnership(data: Record<string, unknown>, actor: { id: string; role: string }): Promise<void> {
  const assetId = data.audioAssetId;
  if (!assetId || actor.role === "SUPER_ADMIN") return;
  const asset = await MediaAsset.findById(assetId).lean();
  if (!asset || asset.kind !== "AUDIO") throw new ApiError(400, "Referenced audio asset does not exist");
  if (String(asset.uploadedBy) !== String(actor.id)) {
    throw new ApiError(403, "You can only attach audio files you own");
  }
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

export async function bulkDeleteQuestions(ids: string[], actor: { id: string; role: string }): Promise<number> {
  const questions = await Question.find({ _id: { $in: ids }, deletedAt: null });
  const deletable = questions.filter((q) => actor.role === "SUPER_ADMIN" || String(q.createdBy) === actor.id);
  if (deletable.length === 0) return 0;
  const res = await Question.updateMany(
    { _id: { $in: deletable.map((q) => q._id) } },
    { $set: { deletedAt: new Date() } },
  );
  return res.modifiedCount ?? deletable.length;
}

export async function duplicateQuestion(id: string, actor: { id: string; role: string }): Promise<unknown> {
  const question = await Question.findOne({ _id: id, deletedAt: null });
  if (!question) throw new ApiError(404, "Question not found");
  if (String(question.createdBy) !== actor.id && actor.role !== "SUPER_ADMIN") {
    throw new ApiError(403, "You can only duplicate your own questions");
  }
  const data = question.toObject();
  delete data._id;
  delete data.__v;
  delete data.createdAt;
  delete data.updatedAt;
  const copy = await Question.create({
    ...data,
    title: `${question.title} (copy)`,
    createdBy: actor.id,
    deletedAt: null,
  });
  await logActivity(actor.id, "DUPLICATE_QUESTION", "Question", copy._id, { sourceId: question._id });
  return copy;
}

export async function getQuestionPreview(id: string): Promise<unknown> {
  const question = await Question.findOne({ _id: id, deletedAt: null }).populate("passageId");
  if (!question) throw new ApiError(404, "Question not found");
  return question;
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