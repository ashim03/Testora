import { Types } from "mongoose";
import { Exam, ExamAssignment, ExamAttempt, ExamAnswer, Question, Batch } from "../models";
import { ApiError, parseSort, generateReceipt } from "../utils/helpers";
import { logActivity, audit, notify } from "./notificationService";
import { resolveTeacherIdForStudent, afterSubmit } from "./gradingService";

export interface ExamQuery {
  page: number;
  limit: number;
  search?: string;
  sort?: string;
  status?: string;
  category?: string;
}

export async function createExam(
  data: Record<string, unknown>,
  actor: { id: string; role: string },
  ip?: string | null,
): Promise<unknown> {
  const exam = await Exam.create({ ...data, createdBy: actor.id });
  await audit("CREATE_EXAM", {
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "Exam",
    entityId: String(exam._id),
    after: { title: exam.title, status: exam.status },
  });
  await logActivity(actor.id, "CREATE_EXAM", "Exam", exam._id, { title: exam.title }, ip);
  return exam;
}

export async function updateExam(id: string, data: Record<string, unknown>, actor: { id: string; role: string }): Promise<unknown> {
  const exam = await Exam.findOne({ _id: id, deletedAt: null });
  if (!exam) throw new ApiError(404, "Exam not found");
  if (String(exam.createdBy) !== actor.id) throw new ApiError(403, "You can only edit your own exams");
  Object.assign(exam, data);
  await exam.save();
  return exam;
}

export async function listExams(query: ExamQuery, viewer: { id: string; role: string }): Promise<{
  data: unknown[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}> {
  const page = query.page || 1;
  const limit = query.limit || 10;
  const filter: Record<string, unknown> = { deletedAt: null };
  if (viewer.role === "TEACHER") filter.createdBy = viewer.id;
  if (query.status) filter.status = query.status;
  if (query.category) filter.category = query.category;
  if (query.search) {
    const re = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.title = re;
  }
  const sort = parseSort(query.sort || "-createdAt", ["createdAt", "title", "status", "type"]);
  const total = await Exam.countDocuments(filter);
  const data = await Exam.find(filter).sort(sort).skip((page - 1) * limit).limit(limit);
  return { data, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getExamForTeacher(id: string, actorId: string): Promise<unknown> {
  const exam = await Exam.findOne({ _id: id, deletedAt: null });
  if (!exam) throw new ApiError(404, "Exam not found");
  if (String(exam.createdBy) !== actorId) throw new ApiError(403, "You can only view your own exams");
  const questions = await questionsForExam(exam);
  return { exam, questions };
}

export async function getExamQuestions(examId: string, actorId: string, role: string): Promise<unknown> {
  const exam = await Exam.findOne({ _id: examId, deletedAt: null });
  if (!exam) throw new ApiError(404, "Exam not found");
  if (role === "TEACHER" && String(exam.createdBy) !== actorId) throw new ApiError(403, "Forbidden");
  const questions = await questionsForExam(exam, true);
  return { exam, questions };
}

async function questionsForExam(exam: {
  sections: Array<{ questionIds: Types.ObjectId[] }>;
  questionIds: Types.ObjectId[];
}, strip = false): Promise<unknown[]> {
  const qids = collectQuestionIds(exam);
  if (qids.length === 0) return [];
  const qs = await Question.find({ _id: { $in: qids }, deletedAt: null }).lean();
  if (!strip) return qs;
  return qs.map((q) => stripAnswers(q as unknown as Record<string, unknown>));
}

function collectQuestionIds(exam: {
  sections: Array<{ questionIds: Types.ObjectId[] }>;
  questionIds: Types.ObjectId[];
}): Types.ObjectId[] {
  return [...exam.questionIds, ...exam.sections.flatMap((s) => s.questionIds)];
}

function stripAnswers(q: Record<string, unknown>): Record<string, unknown> {
  const { correctAnswers, acceptedAnswers, ...safe } = q;
  void correctAnswers;
  void acceptedAnswers;
  return safe;
}

export async function publishExam(id: string, actor: { id: string; role: string }): Promise<unknown> {
  const exam = await Exam.findOne({ _id: id, deletedAt: null });
  if (!exam) throw new ApiError(404, "Exam not found");
  if (String(exam.createdBy) !== actor.id) throw new ApiError(403, "You can only publish your own exams");
  exam.status = "PUBLISHED";
  await exam.save();
  await audit("PUBLISH_EXAM", {
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "Exam",
    entityId: String(exam._id),
    after: { status: "PUBLISHED" },
  });
  return exam;
}

export async function archiveExam(id: string, actor: { id: string; role: string }): Promise<unknown> {
  const exam = await Exam.findOne({ _id: id, deletedAt: null });
  if (!exam) throw new ApiError(404, "Exam not found");
  if (String(exam.createdBy) !== actor.id) throw new ApiError(403, "Forbidden");
  exam.status = "ARCHIVED";
  await exam.save();
  await audit("ARCHIVE_EXAM", { actorId: actor.id, actorRole: actor.role, entityType: "Exam", entityId: String(exam._id) });
  return exam;
}

export async function assignExam(
  examId: string,
  options: { studentIds?: string[]; batchIds?: string[] },
  actor: { id: string; role: string },
): Promise<{ assigned: number }> {
  const exam = await Exam.findOne({ _id: examId, deletedAt: null });
  if (!exam) throw new ApiError(404, "Exam not found");
  if (exam.status === "DRAFT") throw new ApiError(400, "Draft exams cannot be assigned");
  const students = new Set<string>();
  for (const id of options.studentIds || []) students.add(id);
  for (const batchId of options.batchIds || []) {
    const batch = await Batch.findById(batchId);
    if (batch) batch.studentIds.forEach((s) => students.add(String(s)));
  }
  for (const studentId of students) {
    const existing = await ExamAssignment.findOne({ examId, studentId }).lean();
    const teacherId = await resolveTeacherIdForStudent(studentId);
    const payload: Record<string, unknown> = {
      examId,
      studentId,
      assignedBy: actor.id,
      assignedAt: new Date(),
      status: "ASSIGNED",
      dueAt: exam.endAt,
      teacherId,
    };
    if (existing) {
      await ExamAssignment.updateOne({ _id: existing._id }, { $set: { status: "ASSIGNED" } });
    } else {
      await ExamAssignment.create(payload);
    }
    await notify(studentId, "TEST_ASSIGNED", "Test assigned", `A new test "${exam.title}" has been assigned to you.`);
  }
  await audit("ASSIGN_EXAM", {
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "Exam",
    entityId: examId,
    after: { studentCount: students.size },
  });
  return { assigned: students.size };
}

export async function listStudentExams(studentId: string, query: { page?: number; limit?: number }): Promise<unknown> {
  const page = query.page || 1;
  const limit = query.limit || 10;
  const assignments = await ExamAssignment.find({ studentId }).sort({ assignedAt: -1 }).lean();
  const examIds = [...new Set(assignments.map((a) => a.examId))];
  const filter: Record<string, unknown> = {
    _id: { $in: examIds },
    deletedAt: null,
    status: { $in: ["PUBLISHED", "SCHEDULED", "COMPLETED"] },
  };
  const total = examIds.length;
  const exams = await Exam.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
  const data = [];
  for (const e of exams) {
    const a = assignments.find((x) => String(x.examId) === String(e._id));
    const attempt = await ExamAttempt.findOne({ examId: e._id, studentId }).sort({ attemptNumber: -1 }).lean();
    data.push({ exam: e, assignment: a, attempt });
  }
  return { data, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getStudentExam(examId: string, studentId: string): Promise<unknown> {
  const assignment = await ExamAssignment.findOne({ examId, studentId });
  if (!assignment) throw new ApiError(403, "This exam has not been assigned to you");
  const exam = await Exam.findOne({ _id: examId, deletedAt: null });
  if (!exam || exam.status === "DRAFT" || exam.status === "ARCHIVED") throw new ApiError(404, "Exam not available");
  const attempt = await ExamAttempt.findOne({ examId, studentId }).sort({ attemptNumber: -1 }).lean();
  const qids = collectQuestionIds(exam);
  const questionCount = qids.length;
  return { exam, assignment, attempt, questionCount };
}

export async function startAttempt(examId: string, studentId: string): Promise<unknown> {
  const assignment = await ExamAssignment.findOne({ examId, studentId });
  if (!assignment) throw new ApiError(403, "Exam not assigned to you");
  const exam = await Exam.findOne({ _id: examId, deletedAt: null });
  if (!exam) throw new ApiError(404, "Exam not found");
  if (!["PUBLISHED", "SCHEDULED", "COMPLETED"].includes(exam.status)) {
    throw new ApiError(400, "Exam is not available");
  }
  const now = Date.now();
  if (exam.startAt && now < new Date(exam.startAt).getTime()) {
    throw new ApiError(400, "Exam has not started yet");
  }
  const attemptCount = await ExamAttempt.countDocuments({ examId, studentId });
  if (attemptCount >= exam.attemptLimit) {
    throw new ApiError(400, "Attempt limit reached");
  }
  const last = await ExamAttempt.findOne({ examId, studentId }).sort({ attemptNumber: -1 }).lean();
  if (last && last.status === "IN_PROGRESS") {
    const expired = now > new Date(last.expiresAt).getTime();
    if (expired && exam.autoSubmit) {
      await ExamAttempt.updateOne({ _id: last._id }, { $set: { status: "SUBMITTED", submittedAt: new Date(), receipt: generateReceipt() } });
      await ExamAssignment.updateOne({ examId, studentId }, { $set: { status: "COMPLETED" } });
      await afterSubmit(String(last._id));
      return { attempt: last, exam, autoSubmitted: true, resuming: false };
    }
    return { attempt: last, exam, resuming: true };
  }
  if (last && last.status === "SUBMITTED") {
    throw new ApiError(400, "This attempt has already been submitted");
  }
  const durationSec = exam.durationSec || 3600;
  const attemptNumber = attemptCount + 1;
  const attempt = await ExamAttempt.create({
    examId,
    studentId,
    teacherId: await resolveTeacherIdForStudent(studentId),
    attemptNumber,
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + durationSec * 1000),
    status: "IN_PROGRESS",
  });
  await ExamAssignment.updateOne({ _id: assignment._id }, { $set: { status: "STARTED", attemptCount } });
  await logActivity(studentId, "START_EXAM", "ExamAttempt", attempt._id, { examId });
  return { attempt, exam };
}

export async function getAttempt(attemptId: string, studentId: string, role = "STUDENT"): Promise<unknown> {
  const attempt = await ExamAttempt.findOne({ _id: attemptId, studentId });
  if (!attempt) throw new ApiError(404, "Attempt not found");
  const exam = await Exam.findById(attempt.examId);
  if (!exam) throw new ApiError(404, "Exam not found");
  const questions = await questionsForExam(exam, !(role === "TEACHER"));
  const answers = await ExamAnswer.find({ attemptId }).lean();
  return { attempt, exam, questions, answers, now: new Date().toISOString() };
}

export async function saveAnswers(
  attemptId: string,
  studentId: string,
  answers: Array<{ questionId: string; answer: unknown; answered?: boolean }>,
): Promise<number> {
  const attempt = await ExamAttempt.findOne({ _id: attemptId, studentId });
  if (!attempt) throw new ApiError(404, "Attempt not found");
  if (attempt.status !== "IN_PROGRESS") throw new ApiError(400, "Attempt is not in progress");
  for (const a of answers) {
    const answered = a.answered !== false && a.answer !== null && a.answer !== "" && a.answer !== undefined;
    await ExamAnswer.updateOne(
      { attemptId, questionId: a.questionId },
      { $set: { answer: a.answer, answered } },
      { upsert: true },
    );
  }
  return answers.length;
}

export async function logIntegrityEvent(
  attemptId: string,
  studentId: string,
  type: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const attempt = await ExamAttempt.findOne({ _id: attemptId, studentId });
  if (!attempt) throw new ApiError(404, "Attempt not found");
  attempt.integrityEvents.push({ type, occurredAt: new Date(), metadata: metadata || {} });
  await attempt.save();
}

export async function submitAttempt(attemptId: string, studentId: string): Promise<unknown> {
  const attempt = await ExamAttempt.findOne({ _id: attemptId, studentId });
  if (!attempt) throw new ApiError(404, "Attempt not found");
  if (!["IN_PROGRESS", "NOT_STARTED"].includes(attempt.status)) {
    throw new ApiError(400, "Attempt has already been submitted");
  }
  attempt.status = "SUBMITTED";
  attempt.submittedAt = new Date();
  attempt.receipt = generateReceipt();
  await attempt.save();
  await ExamAssignment.updateOne({ examId: attempt.examId, studentId }, { $set: { status: "COMPLETED" } });
  await afterSubmit(String(attempt._id));
  await notify(studentId, "SUBMISSION_SUCCESS", "Submission received", "Your examination was submitted successfully.");
  return { attempt };
}

export async function listTeacherSubmissions(
  teacherId: string,
  query: { page?: number; limit?: number; status?: string; sort?: string },
): Promise<{ data: unknown[]; total: number; page: number; limit: number; pages: number }> {
  const page = query.page || 1;
  const limit = query.limit || 10;
  const exams = await Exam.find({ createdBy: teacherId, deletedAt: null }).select("_id").lean();
  const examIds = exams.map((e) => e._id);
  const filter: Record<string, unknown> = { examId: { $in: examIds }, status: { $ne: "NOT_STARTED" } };
  if (query.status) filter.status = query.status;
  const total = await ExamAttempt.countDocuments(filter);
  const sort = parseSort(query.sort || "-createdAt", ["createdAt", "status", "finalScore"]);
  const data = await ExamAttempt.find(filter)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("examId", "title category")
    .populate("studentId", "firstName lastName email");
  return { data, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getTeacherSubmission(attemptId: string, teacherId: string): Promise<unknown> {
  const attempt = await ExamAttempt.findById(attemptId).populate("examId").populate("studentId", "firstName lastName email");
  if (!attempt) throw new ApiError(404, "Submission not found");
  const exam = (attempt as unknown as { examId: any }).examId as {
    createdBy: Types.ObjectId;
    sections: Array<{ questionIds: Types.ObjectId[] }>;
    questionIds: Types.ObjectId[];
  };
  if (String(exam.createdBy) !== teacherId) throw new ApiError(403, "Forbidden");
  const questions = await questionsForExam({ sections: exam.sections, questionIds: exam.questionIds });
  const answers = await ExamAnswer.find({ attemptId }).lean();
  return { attempt, exam, questions, answers };
}

export async function listTeacherResults(teacherId: string): Promise<unknown[]> {
  const exams = await Exam.find({ createdBy: teacherId, deletedAt: null }).select("_id").lean();
  const examIds = exams.map((e) => e._id);
  return ExamAttempt.find({
    examId: { $in: examIds },
    status: { $in: ["GRADED", "PUBLISHED"] },
  })
    .sort({ updatedAt: -1 })
    .populate("examId", "title category")
    .populate("studentId", "firstName lastName email");
}