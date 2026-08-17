import { Exam, ExamAssignment, ExamAttempt } from "../models";
import { resolveTeacherIdForStudent } from "./gradingService";

interface PageQuery {
  page?: number;
  limit?: number;
}

interface PracticeQuery extends PageQuery {
  search?: string;
  category?: string;
  part?: string;
}

function latestAttemptsByExam(attempts: Array<{ examId: unknown; attemptNumber?: number }>): Map<string, unknown> {
  const latest = new Map<string, unknown>();
  for (const attempt of attempts) {
    const key = String(attempt.examId);
    if (!latest.has(key)) latest.set(key, attempt);
  }
  return latest;
}

function attemptCountsByExam(attempts: Array<{ examId: unknown }>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const attempt of attempts) {
    const key = String(attempt.examId);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

export async function listStudentExams(
  studentId: string,
  query: PageQuery,
): Promise<unknown> {
  const page = query.page || 1;
  const limit = query.limit || 10;

  const assignments = await ExamAssignment.find({ studentId }).sort({ assignedAt: -1 }).lean();
  const examIds = [...new Set(assignments.map((a) => a.examId))];
  const filter: Record<string, unknown> = {
    _id: { $in: examIds },
    deletedAt: null,
    status: { $in: ["PUBLISHED", "SCHEDULED", "COMPLETED"] },
  };

  const exams = await Exam.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const pageExamIds = exams.map((exam) => exam._id);
  const attempts = pageExamIds.length
    ? await ExamAttempt.find({ examId: { $in: pageExamIds }, studentId })
      .sort({ attemptNumber: -1 })
      .lean()
    : [];
  const latestByExam = latestAttemptsByExam(attempts);
  const assignmentByExam = new Map(assignments.map((assignment) => [String(assignment.examId), assignment]));

  const data = exams.map((exam) => ({
    exam,
    assignment: assignmentByExam.get(String(exam._id)),
    attempt: latestByExam.get(String(exam._id)),
  }));

  return { data, total: examIds.length, page, limit, pages: Math.ceil(examIds.length / limit) };
}

export async function listPracticeExams(
  studentId: string,
  query: PracticeQuery,
): Promise<unknown> {
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
  const exams = await Exam.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const examIds = exams.map((exam) => exam._id);
  const attempts = examIds.length
    ? await ExamAttempt.find({ examId: { $in: examIds }, studentId })
      .sort({ attemptNumber: -1 })
      .lean()
    : [];
  const latestByExam = latestAttemptsByExam(attempts);
  const countsByExam = attemptCountsByExam(attempts);

  const data = exams.map((exam) => {
    const used = countsByExam.get(String(exam._id)) || 0;
    const questionCount = exam.sections.reduce(
      (count, section) => count + section.questionIds.length,
      0,
    ) + exam.questionIds.length;
    return {
      exam: { ...exam, showsAnswers: exam.showAnswersImmediately },
      attempt: latestByExam.get(String(exam._id)),
      attemptsUsed: used,
      questionCount,
      remainingAttempts: Math.max(0, (exam.attemptLimit || 1) - used),
    };
  });

  return { data, total, page, limit, pages: Math.ceil(total / limit) };
}
