import { Types } from "mongoose";
import { Exam, ExamAssignment, ExamAttempt, ExamAnswer, Question, Batch, MediaAsset } from "../models";
import { SECTIONAL_PARTS, SECTIONAL_CATEGORIES } from "@testora-platform/shared";
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
  await assertSectionAudioOwnership(data, actor);
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
  if (actor.role !== "SUPER_ADMIN" && String(exam.createdBy) !== actor.id) throw new ApiError(403, "You can only edit your own exams");
  await assertSectionAudioOwnership(data, actor);
  Object.assign(exam, data);
  await exam.save();
  return exam;
}

async function assertSectionAudioOwnership(data: Record<string, unknown>, actor: { id: string; role: string }): Promise<void> {
  if (actor.role === "SUPER_ADMIN") return;
  const sections = Array.isArray(data.sections) ? data.sections : [];
  const assetIds = new Set(sections.map((s) => (s as { audioAssetId?: unknown })?.audioAssetId).filter(Boolean));
  if (assetIds.size === 0) return;
  const assets = await MediaAsset.find({ _id: { $in: [...assetIds] }, kind: "AUDIO" }).lean();
  const owned = new Set(assets.filter((a) => String(a.uploadedBy) === String(actor.id)).map((a) => String(a._id)));
  for (const assetId of assetIds) {
    if (!owned.has(String(assetId))) {
      throw new ApiError(403, "You can only attach audio files you own");
    }
  }
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
  const found = await Question.find({ _id: { $in: qids }, deletedAt: null }).lean();
  const byId = new Map(found.map((q) => [String(q._id), q]));
  const qs = qids.map((id) => byId.get(String(id))).filter((q): q is NonNullable<typeof q> => Boolean(q));
  if (!strip) return qs;
  return qs.map((q) => stripAnswers(q as unknown as Record<string, unknown>));
}

function collectQuestionIds(exam: {
  sections: Array<{ questionIds: Types.ObjectId[] }>;
  questionIds: Types.ObjectId[];
}): Types.ObjectId[] {
  return [...exam.sections.flatMap((s) => s.questionIds), ...exam.questionIds];
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
  if (actor.role !== "SUPER_ADMIN" && String(exam.createdBy) !== actor.id) throw new ApiError(403, "You can only publish your own exams");
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
  if (actor.role !== "SUPER_ADMIN" && String(exam.createdBy) !== actor.id) throw new ApiError(403, "Forbidden");
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
  if (actor.role !== "SUPER_ADMIN" && String(exam.createdBy) !== actor.id) {
    throw new ApiError(403, "You can only assign your own exams");
  }
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
    await notify(studentId, "TEST_ASSIGNED", "Test assigned", `A new test "${exam.title}" has been assigned to you.`, {
      examId: String(exam._id),
    });
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

export async function listPracticeExams(studentId: string, query: { page?: number; limit?: number; search?: string; category?: string; part?: string }): Promise<unknown> {
  const page = query.page || 1;
  const limit = query.limit || 10;
  const teacherId = await resolveTeacherIdForStudent(studentId);
  if (!teacherId) return { data: [], total: 0, page, limit, pages: 0 };
  const filter: Record<string, unknown> = {
    type: { $in: ["PRACTICE", "SECTIONAL"] },
    status: "PUBLISHED",
    deletedAt: null,
    createdBy: teacherId,
  };
  if (query.category) filter.category = query.category;
  if (query.part) filter.part = query.part;
  if (query.search) {
    const re = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.title = re;
  }
  const total = await Exam.countDocuments(filter);
  const exams = await Exam.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
  const data = [];
  for (const e of exams) {
    const attempt = await ExamAttempt.findOne({ examId: e._id, studentId }).sort({ attemptNumber: -1 }).lean();
    const used = await ExamAttempt.countDocuments({ examId: e._id, studentId });
    const qids = collectQuestionIds(e);
    const hasCorrect = e.showAnswersImmediately;
    data.push({ exam: { ...e, showsAnswers: hasCorrect }, attempt, attemptsUsed: used, questionCount: qids.length, remainingAttempts: Math.max(0, (e.attemptLimit || 1) - used) });
  }
  return { data, total, page, limit, pages: Math.ceil(total / limit) };
}

const FINISHED_STATES = ["SUBMITTED", "UNDER_REVIEW", "GRADED", "PUBLISHED"];

export async function getSectionalPracticeSummary(studentId: string): Promise<unknown> {
  const teacherId = await resolveTeacherIdForStudent(studentId);
  const baseFilter: Record<string, unknown> = {
    type: { $in: ["PRACTICE", "SECTIONAL"] },
    status: "PUBLISHED",
    deletedAt: null,
    category: { $in: SECTIONAL_CATEGORIES },
  };
  if (teacherId) baseFilter.createdBy = teacherId;

  const exams = await Exam.find(baseFilter).lean();
  const examsByCategory: Record<string, typeof exams> = {};
  for (const e of exams) {
    (examsByCategory[e.category] ||= []).push(e);
  }
  const examIds = exams.map((e) => e._id);
  const attempts = examIds.length
    ? await ExamAttempt.find({ studentId, examId: { $in: examIds } }).lean()
    : [];

  const attemptsByExam: Record<string, Array<{ status: string }>> = {};
  for (const a of attempts) {
    (attemptsByExam[String(a.examId)] ||= []).push(a);
  }

  const sections = SECTIONAL_CATEGORIES.map((category) => {
    const cfg = SECTIONAL_PARTS[category];
    const categoryExams = examsByCategory[category] || [];
    const completed = categoryExams.filter((e) =>
      (attemptsByExam[String(e._id)] || []).some((a) => FINISHED_STATES.includes(a.status)),
    ).length;
    const inProgress = categoryExams.some((e) =>
      (attemptsByExam[String(e._id)] || []).some((a) => a.status === "IN_PROGRESS"),
    );

    const parts = cfg.parts.map((p) => {
      const partExams = categoryExams.filter((e) => e.part === p.key);
      const partCompleted = partExams.filter((e) =>
        (attemptsByExam[String(e._id)] || []).some((a) => FINISHED_STATES.includes(a.status)),
      ).length;
      const partInProgress = partExams.some((e) =>
        (attemptsByExam[String(e._id)] || []).some((a) => a.status === "IN_PROGRESS"),
      );
      const status = partExams.length === 0
        ? "NOT_STARTED"
        : partInProgress
          ? "IN_PROGRESS"
          : partCompleted >= partExams.length
            ? "COMPLETED"
            : partCompleted > 0
              ? "IN_PROGRESS"
              : "NOT_STARTED";
      return {
        key: p.key,
        label: p.label,
        available: partExams.length,
        completed: partCompleted,
        status,
      };
    });

    return {
      category,
      label: cfg.label,
      available: categoryExams.length,
      completed,
      inProgress,
      progressPercent: categoryExams.length ? Math.round((completed / categoryExams.length) * 100) : 0,
      parts,
    };
  });

  return { sections };
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
  const exam = await Exam.findOne({ _id: examId, deletedAt: null });
  if (!exam) throw new ApiError(404, "Exam not found");
  if (!["PUBLISHED", "SCHEDULED", "COMPLETED"].includes(exam.status)) {
    throw new ApiError(400, "Exam is not available");
  }
  const teacherId = await resolveTeacherIdForStudent(studentId);
  let assignment = await ExamAssignment.findOne({ examId, studentId });
  const isPracticeForStudent =
    ["PRACTICE", "SECTIONAL"].includes(exam.type) &&
    exam.status === "PUBLISHED" &&
    !!teacherId &&
    String(exam.createdBy) === String(teacherId);
  if (!assignment) {
    if (!isPracticeForStudent) throw new ApiError(403, "Exam not assigned to you");
    assignment = await ExamAssignment.create({
      examId,
      studentId,
      assignedBy: exam.createdBy,
      teacherId,
      assignedAt: new Date(),
      status: "ASSIGNED",
      dueAt: exam.endAt,
    });
  }
  const now = Date.now();
  if (exam.startAt && now < new Date(exam.startAt).getTime()) {
    throw new ApiError(400, "Exam has not started yet");
  }
  if (exam.endAt && now > new Date(exam.endAt).getTime()) {
    throw new ApiError(400, "Exam has closed");
  }
  const attemptCount = await ExamAttempt.countDocuments({ examId, studentId });
  if (attemptCount >= exam.attemptLimit) {
    throw new ApiError(400, "Attempt limit reached");
  }
  const last = await ExamAttempt.findOne({ examId, studentId }).sort({ attemptNumber: -1 }).lean();
  if (last && last.status === "IN_PROGRESS") {
    const expired = now > new Date(last.expiresAt).getTime();
    if (expired) {
      await ExamAttempt.updateOne({ _id: last._id }, { $set: { status: "SUBMITTED", submittedAt: new Date(), receipt: generateReceipt() } });
      await ExamAssignment.updateOne({ examId, studentId }, { $set: { status: "COMPLETED" } });
      await afterSubmit(String(last._id));
      return { attempt: last, exam, autoSubmitted: true, resuming: false };
    }
    return { attempt: last, exam, resuming: true };
  }
  const durationSec = exam.durationSec || 3600;
  const attemptNumber = attemptCount + 1;
  const attempt = await ExamAttempt.create({
    examId,
    studentId,
    teacherId,
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
  const exam = await Exam.findById(attempt.examId);
  if (exam && !exam.allowLateSubmission && Date.now() > new Date(attempt.expiresAt).getTime()) {
    throw new ApiError(400, "Attempt time has expired");
  }
  const qids = exam ? new Set(collectQuestionIds(exam).map(String)) : null;
  for (const a of answers) {
    if (qids && !qids.has(String(a.questionId))) {
      throw new ApiError(400, "Answer submitted for a question not in this exam");
    }
    const answered = a.answered !== false && a.answer !== null && a.answer !== "" && a.answer !== undefined;
    await ExamAnswer.updateOne(
      { attemptId, questionId: a.questionId },
      {
        $set: { answer: a.answer, answered },
        $setOnInsert: {
          attemptId,
          examId: attempt.examId,
          studentId,
          questionId: a.questionId,
          sectionIndex: 0,
        },
      },
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
  await notify(studentId, "SUBMISSION_SUCCESS", "Submission received", "Your examination was submitted successfully.", {
    attemptId: String(attempt._id),
    examId: String(attempt.examId),
  });
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
  if (query.status) filter.status = { $in: query.status.split(",") } as never;
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
