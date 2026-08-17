import { Batch, Exam, ExamAttempt, ExamAssignment, Assignment, AssignmentSubmission, Result, TeacherStudentAssignment, StudentProfile, Feedback, Notification, CourseEnrollment } from "../models";
import { ApiError } from "../utils/helpers";

export async function studentDashboard(studentId: string): Promise<unknown> {
  const [profile, assignment, batches, exams, results, enrollments] = await Promise.all([
    StudentProfile.findOne({ userId: studentId }).lean(),
    TeacherStudentAssignment.findOne({ studentId, status: "ACTIVE", endedAt: null }).populate("teacherId", "firstName lastName email").lean(),
    Batch.find({ studentIds: studentId, archived: false }).populate("courseId").lean(),
    ExamAssignment.find({ studentId }).lean(),
    Result.find({ studentId, published: true }).sort({ createdAt: -1 }).limit(10).lean(),
    CourseEnrollment.find({ studentId, status: "ACTIVE" }).select("courseId progressPercent completedLessonCount totalLessonCount").lean(),
  ]);
  const [assignedAssignments, submissions] = await Promise.all([
    Assignment.find({ deletedAt: null, published: true, status: { $in: ["ASSIGNED", "OPEN"] }, studentIds: studentId }).select("_id").lean(),
    AssignmentSubmission.find({ studentId, status: { $in: ["SUBMITTED", "RESUBMITTED", "GRADED", "PUBLISHED"] } }).select("assignmentId").lean(),
  ]);
  const submittedAssignmentIds = new Set(submissions.map((s) => String(s.assignmentId)));
  const pendingAssignments = assignedAssignments.filter((a) => !submittedAssignmentIds.has(String(a._id))).length;
  const examIds = [...new Set(exams.map((e) => String(e.examId)))];
  const examsDetail = await Exam.find({ _id: { $in: examIds }, deletedAt: null, status: { $in: ["PUBLISHED", "SCHEDULED", "COMPLETED"] } }).lean();
  const [attemptCount, completedExams] = await Promise.all([
    ExamAttempt.countDocuments({ studentId }),
    ExamAttempt.countDocuments({ studentId, status: { $in: ["SUBMITTED", "UNDER_REVIEW", "GRADED", "PUBLISHED"] } }),
  ]);
  const upcoming = examsDetail.filter((e) => e.status === "PUBLISHED" && (!e.endAt || new Date(e.endAt).getTime() > Date.now()));
  const teacher = profile?.currentTeacherId;
  const teacherName = assignment?.teacherId
    ? `${(assignment.teacherId as unknown as { firstName: string }).firstName} ${(assignment.teacherId as unknown as { lastName: string }).lastName}`
    : null;
  return {
    welcome: { id: studentId }, teacherName, teacherId: teacher || null,
    batch: batches[0] || null, batchCount: batches.length, availableExams: upcoming.length,
    totalAssignedExams: exams.length, completedExams, pendingAssignments, recentResults: results,
    attemptCount, currentBatch: batches[0] || null, courseCount: enrollments.length, courseProgress: enrollments,
  };
}

export async function studentProgress(studentId: string): Promise<unknown> {
  const results = await Result.find({ studentId, published: true }).sort({ createdAt: -1 }).lean();
  const trend = results.map((r) => ({ label: r.examTitle || r.category, score: r.finalScore, percentage: r.percentage, band: r.practiceBand, pte: r.estimatedPteScore }));
  const byCategory: Record<string, number[]> = {};
  for (const r of results) { const key = r.category || "OTHER"; (byCategory[key] ||= []).push(r.finalScore || 0); }
  const skillAverages = Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100]));
  return { totalResults: results.length, averagePercentage: results.length ? Math.round(results.reduce((a, r) => a + (r.percentage || 0), 0) / results.length * 100) / 100 : 0, trend, skillAverages };
}

export async function studentFeedback(studentId: string): Promise<unknown> {
  return Feedback.find({ studentId, status: "PUBLISHED" }).sort({ createdAt: -1 }).populate("teacherId", "firstName lastName").lean();
}

export async function studentResults(studentId: string, query: { page?: number; limit?: number }): Promise<unknown> {
  const page = query.page || 1; const limit = query.limit || 10; const filter = { studentId, published: true };
  const [total, data] = await Promise.all([
    Result.countDocuments(filter),
    Result.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return { data, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function studentResultById(resultId: string, studentId: string): Promise<unknown> {
  const result = await Result.findOne({ _id: resultId, studentId });
  if (!result) throw new ApiError(404, "Result not found");
  const attempt = result.attemptId ? await AttemptModel.findById(result.attemptId).lean() : null;
  return { result, attempt, disclaimer: result.category.startsWith("PTE") ? "PTE" : "IELTS" };
}
const AttemptModel = ExamAttempt;

export async function studentNotifications(studentId: string, query: { page?: number; limit?: number }): Promise<unknown> {
  const page = query.page || 1; const limit = query.limit || 10; const filter = { recipientId: studentId };
  const [total, data, unread] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments({ recipientId: studentId, read: false }),
  ]);
  return { data, total, unread, page, limit, pages: Math.ceil(total / limit) };
}

export async function markNotificationRead(notificationId: string, studentId: string): Promise<void> {
  await Notification.updateOne({ _id: notificationId, recipientId: studentId }, { $set: { read: true, readAt: new Date() } });
}
export async function markAllNotificationsRead(studentId: string): Promise<void> {
  await Notification.updateMany({ recipientId: studentId, read: false }, { $set: { read: true, readAt: new Date() } });
}
