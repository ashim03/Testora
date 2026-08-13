import { Types } from "mongoose";
import { ExamAttempt, ExamAnswer, Question, Exam, Grade, Result, StudentProfile, TeacherStudentAssignment, SystemSetting, Rubric } from "../models";
import { ApiError } from "../utils/helpers";
import { audit, notify, logActivity } from "./notificationService";

const OBJECTIVE_TYPES = new Set([
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "MULTIPLE_ANSWER",
  "TRUE_FALSE_NOT_GIVEN",
  "YES_NO_NOT_GIVEN",
  "FILL_BLANK",
  "SHORT_ANSWER",
  "MATCHING_HEADINGS",
  "MATCHING_INFORMATION",
  "MATCHING_SENTENCE_ENDING",
  "DRAG_DROP",
  "REORDER_PARAGRAPHS",
  "LISTENING_DICTATION",
  "ANSWER_SHORT_QUESTION",
  "HIGHLIGHT_CORRECT_SUMMARY",
  "SELECT_MISSING_WORD",
  "HIGHLIGHT_INCORRECT_WORDS",
]);

export async function resolveTeacherIdForStudent(studentId: string): Promise<Types.ObjectId | null> {
  const assignment = await TeacherStudentAssignment.findOne({ studentId, status: "ACTIVE", endedAt: null }).lean();
  if (assignment) return assignment.teacherId;
  const profile = await StudentProfile.findOne({ userId: studentId }).lean();
  return (profile?.currentTeacherId as Types.ObjectId | null) ?? null;
}

export function normalizeAnswer(value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => String(v).trim().toLowerCase()).sort().join("|");
  return String(value ?? "").trim().toLowerCase();
}

export function isCorrectAnswer(question: { type: string; correctAnswers: string[]; acceptedAnswers?: string[] }, answer: unknown): boolean {
  if (!answer || (Array.isArray(answer) && answer.length === 0)) return false;
  const accepted = [
    ...(question.correctAnswers || []),
    ...(question.acceptedAnswers || []),
  ].map((a) => String(a).trim().toLowerCase());
  const norm = normalizeAnswer(answer);
  return accepted.includes(norm);
}

export function scoreAnswer(question: { type: string; correctAnswers: string[]; acceptedAnswers?: string[]; marks: number; negativeMarks: number }, answer: unknown): { earned: number; isCorrect: boolean } {
  const correct = isCorrectAnswer(question, answer);
  if (correct) return { earned: question.marks, isCorrect: true };
  return { earned: -(question.negativeMarks || 0), isCorrect: false };
}

export async function gradeObjectiveAttempt(attemptId: string): Promise<{
  objectiveScore: number;
  rawScore: number;
  maxScore: number;
  answered: number;
  total: number;
}> {
  const attempt = await ExamAttempt.findById(attemptId);
  if (!attempt) throw new ApiError(404, "Attempt not found");
  const exam = await Exam.findById(attempt.examId);
  if (!exam) throw new ApiError(404, "Exam not found");
  const qids = [
    ...(exam.questionIds || []),
    ...(exam.sections || []).flatMap((s) => s.questionIds || []),
  ];
  const questions = await Question.find({ _id: { $in: qids }, deletedAt: null }).lean();
  const answers = await ExamAnswer.find({ attemptId }).lean();
  const answerMap = new Map(answers.map((a) => [String(a.questionId), a.answer]));
  let objectiveScore = 0;
  let rawScore = 0;
  let maxScore = 0;
  let answered = 0;
  let subjectiveCount = 0;
  for (const q of questions) {
    const answer = answerMap.get(String(q._id));
    const isObjective = OBJECTIVE_TYPES.has(q.type);
    if (isObjective) {
      maxScore += q.marks;
      const raw = answerMap.get(String(q._id));
      const attempted = !(raw === undefined || raw === null || raw === "" || (Array.isArray(raw) && raw.length === 0));
      let earned = 0;
      let isCorrect = false;
      if (attempted) {
        const res = scoreAnswer(q, raw);
        isCorrect = res.isCorrect;
        earned = res.isCorrect || exam.negativeMarking ? res.earned : 0;
      }
      objectiveScore += earned;
      rawScore += earned;
      if (isCorrect) answered += 1;
      await ExamAnswer.updateOne(
        { attemptId, questionId: q._id },
        { $set: { isObjective: true, autoCorrect: { isCorrect, earnedScore: earned } } },
      );
    } else {
      subjectiveCount += 1;
      maxScore += q.marks;
      await ExamAnswer.updateOne(
        { attemptId, questionId: q._id },
        { $set: { isObjective: false } },
      );
    }
  }
  attempt.objectiveScore = objectiveScore;
  attempt.rawScore = rawScore;
  attempt.maxScore = maxScore;
  attempt.objectiveEvaluator = true;
  if (subjectiveCount === 0) {
    attempt.status = "GRADED";
    attempt.finalScore = objectiveScore;
    attempt.practiceBand = await bandFromScore(exam, objectiveScore, maxScore);
    attempt.estimatedPteScore = await pteFromScore(exam, objectiveScore, maxScore);
  } else {
    attempt.status = "UNDER_REVIEW";
    attempt.finalScore = null;
  }
  await attempt.save();
  return { objectiveScore, rawScore, maxScore, answered, total: questions.length };
}

export async function afterSubmit(attemptId: string): Promise<void> {
  await gradeObjectiveAttempt(attemptId);
}

export async function gradeAttemptManually(
  attemptId: string,
  data: {
    score?: number;
    feedback?: string;
    strengths?: string[];
    improvements?: string[];
    criteria?: Array<{ key: string; label: string; score: number; max: number; comment?: string }>;
    saveAsDraft?: boolean;
    requestResubmission?: boolean;
  },
  actor: { id: string; role: string },
  ip?: string | null,
): Promise<unknown> {
  const attempt = await ExamAttempt.findById(attemptId);
  if (!attempt) throw new ApiError(404, "Attempt not found");
  const exam = await Exam.findById(attempt.examId);
  if (!exam) throw new ApiError(404, "Exam not found");
  if (actor.role === "TEACHER" && String(exam.createdBy) !== actor.id) {
    throw new ApiError(403, "You can only grade exams you created");
  }
  const studentId = attempt.studentId.toString();
  const teacherId = String(exam.createdBy);

  const gradeScore = data.score ?? attempt.objectiveScore ?? 0;
  const finalScore = Math.max(0, Math.min(gradeScore, attempt.maxScore ?? gradeScore));
  const grade = await Grade.create({
    attemptId: attempt._id,
    graderId: actor.id,
    studentId,
    teacherId,
    score: gradeScore,
    criteria: data.criteria || [],
    feedback: data.feedback || "",
    strengths: data.strengths || [],
    improvements: data.improvements || [],
    status: data.saveAsDraft ? "DRAFT" : "PUBLISHED",
  });
  attempt.subjectiveScore = Math.max(0, finalScore - (attempt.objectiveScore ?? 0));
  attempt.finalScore = finalScore;
  attempt.practiceBand = await bandFromScore(exam, attempt.finalScore, attempt.maxScore || 1);
  attempt.estimatedPteScore = await pteFromScore(exam, attempt.finalScore, attempt.maxScore || 1);
  if (data.requestResubmission) {
    attempt.status = "SUBMITTED";
    attempt.receipt = null;
  } else {
    attempt.status = data.saveAsDraft ? "UNDER_REVIEW" : "GRADED";
  }
  await attempt.save();
  await audit("GRADE_ATTEMPT", {
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "ExamAttempt",
    entityId: attemptId,
    after: { finalScore: attempt.finalScore, status: attempt.status, saveAsDraft: !!data.saveAsDraft },
  });
  await logActivity(actor.id, "GRADE_ATTEMPT", "ExamAttempt", attempt._id, {}, ip);
  if (!data.saveAsDraft && !data.requestResubmission) {
    await notify(studentId, "TEACHER_FEEDBACK", "Feedback ready", `Your test "${exam.title}" has been graded.`, {
      attemptId: String(attempt._id),
      examId: String(exam._id),
    });
  }
  return { attempt, grade };
}

export async function publishResult(attemptId: string, actor: { id: string; role: string }, ip?: string | null): Promise<unknown> {
  const attempt = await ExamAttempt.findById(attemptId);
  if (!attempt) throw new ApiError(404, "Attempt not found");
  const exam = await Exam.findById(attempt.examId);
  if (!exam) throw new ApiError(404, "Exam not found");
  if (actor.role === "TEACHER" && String(exam.createdBy) !== actor.id) {
    throw new ApiError(403, "You can only publish results for exams you created");
  }
  const finalScore = attempt.finalScore ?? attempt.objectiveScore ?? 0;
  const maxScore = attempt.maxScore ?? finalScore;
  const percentage = maxScore > 0 ? Math.min(100, Math.max(0, Math.round((finalScore / maxScore) * 10000) / 100)) : 0;
  await Result.updateOne(
    { attemptId },
    {
      $set: {
        attemptId,
        examId: attempt.examId,
        studentId: attempt.studentId,
        teacherId: exam.createdBy,
        examTitle: exam.title,
        category: exam.category,
        objectiveScore: attempt.objectiveScore,
        subjectiveScore: attempt.subjectiveScore,
        finalScore,
        rawScore: attempt.rawScore,
        maxScore,
        percentage,
        practiceBand: attempt.practiceBand,
        estimatedPteScore: attempt.estimatedPteScore,
        published: true,
        publishedBy: actor.id,
        publishedAt: new Date(),
      },
    },
    { upsert: true },
  );
  attempt.status = "PUBLISHED";
  await attempt.save();
  await audit("PUBLISH_RESULT", {
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "Result",
    entityId: attemptId,
    after: { finalScore, published: true },
  });
  await notify(attempt.studentId.toString(), "RESULT_PUBLISHED", "Result published", `Your result for "${exam.title}" has been published.`, {
    attemptId: String(attempt._id),
    examId: String(exam._id),
  });
  await logActivity(actor.id, "PUBLISH_RESULT", "Result", attempt._id, { examId: attempt.examId }, ip);
  return { attempt, result: { finalScore, percentage, practiceBand: attempt.practiceBand, estimatedPteScore: attempt.estimatedPteScore } };
}

export async function reopenAttempt(attemptId: string, actor: { id: string; role: string }): Promise<unknown> {
  const attempt = await ExamAttempt.findById(attemptId);
  if (!attempt) throw new ApiError(404, "Attempt not found");
  const exam = await Exam.findById(attempt.examId);
  if (actor.role === "TEACHER" && exam && String(exam.createdBy) !== actor.id) {
    throw new ApiError(403, "You can only reopen attempts for exams you created");
  }
  const durationSec = exam?.durationSec || 3600;
  attempt.status = "IN_PROGRESS";
  attempt.submittedAt = null;
  attempt.expiresAt = new Date(Date.now() + durationSec * 1000);
  await attempt.save();
  await audit("REOPEN_ATTEMPT", {
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "ExamAttempt",
    entityId: attemptId,
    after: { status: "IN_PROGRESS" },
  });
  return attempt;
}

async function conversionRows(category: string): Promise<Array<{ minRaw: number; maxRaw: number; practiceBand: number }>> {
  const setting = await SystemSetting.findOne({ key: `conversion:${category}` }).lean();
  if (setting && Array.isArray(setting.value)) return setting.value as Array<{ minRaw: number; maxRaw: number; practiceBand: number }>;
  return [];
}

export async function bandFromScore(exam: { category: string }, score: number, maxScore: number): Promise<number | null> {
  const rows = await conversionRows(exam.category);
  if (rows.length === 0) {
    const pct = maxScore > 0 ? score / maxScore : 0;
    return Math.max(0, Math.round((pct * 9) * 2) / 2);
  }
  const rawPct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const matched = rows.find((r) => rawPct >= r.minRaw && rawPct <= r.maxRaw);
  return matched ? matched.practiceBand : Math.max(1, Math.round(rawPct / 9));
}

export async function pteFromScore(exam: { category: string }, score: number, maxScore: number): Promise<number | null> {
  if (exam.category.startsWith("PTE")) {
    const pct = maxScore > 0 ? score / maxScore : 0;
    return Math.max(10, Math.round(pct * 90));
  }
  return null;
}

export function isObjectiveQuestionType(type: string): boolean {
  return OBJECTIVE_TYPES.has(type);
}

export async function updateConversionTable(category: string, rows: Array<{ minRaw: number; maxRaw: number; practiceBand: number }>): Promise<void> {
  await SystemSetting.updateOne(
    { key: `conversion:${category}` },
    { $set: { value: rows } },
    { upsert: true },
  );
}

export async function saveRubric(data: { title?: string; name?: string; type: string; criteria: Array<{ key: string; label: string; max: number; weight: number }>; createdBy: string }): Promise<unknown> {
  return Rubric.create({ title: data.title || data.name || "Rubric", type: data.type, criteria: data.criteria, createdBy: data.createdBy });
}
