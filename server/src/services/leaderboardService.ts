import { Batch, Result, User } from "../models";
import { ApiError } from "../utils/helpers";

export async function mockLeaderboard(studentId: string, examId?: string, limit = 20): Promise<unknown> {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const base: Record<string, unknown> = { published: true };
  if (examId) base.examId = examId;
  const rows = await Result.find(base).sort({ finalScore: -1, percentage: -1, createdAt: 1 }).limit(safeLimit * 3).lean();
  const ids = rows.map((r) => r.studentId);
  const users = await User.find({ _id: { $in: ids } }).select("name firstName lastName").lean();
  const names = new Map(users.map((u) => [String(u._id), String((u as any).name || `${(u as any).firstName || ""} ${(u as any).lastName || ""}`).trim() || "Student"]));
  const leaderboard = rows.slice(0, safeLimit).map((r, index) => ({ rank: index + 1, studentId: String(r.studentId), name: String(r.studentId) === studentId ? "You" : names.get(String(r.studentId)) || "Student", score: r.finalScore ?? r.percentage ?? r.rawScore ?? 0, percentage: r.percentage ?? null, examId: String(r.examId), examTitle: r.examTitle, submittedAt: r.createdAt }));
  const mine = await Result.findOne({ ...base, studentId }).sort({ finalScore: -1, percentage: -1, createdAt: 1 }).lean();
  let myRank: number | null = null;
  if (mine) {
    const myScore = mine.finalScore ?? mine.percentage ?? mine.rawScore ?? 0;
    myRank = 1 + await Result.countDocuments({ ...base, $or: [{ finalScore: { $gt: myScore } }, { finalScore: myScore, percentage: { $gt: mine.percentage ?? -1 } }] });
  }
  return { leaderboard, myRank, myScore: mine?.finalScore ?? mine?.percentage ?? null, examId: examId || null };
}

export async function cohortAnalytics(teacherId: string, batchId?: string): Promise<unknown> {
  const query: Record<string, unknown> = { teacherId, archived: false };
  if (batchId) query._id = batchId;
  const batches = await Batch.find(query).select("name studentIds courseId startDate endDate").lean();
  if (batchId && !batches.length) throw new ApiError(404, "Cohort not found");
  const allStudentIds = [...new Set(batches.flatMap((b) => b.studentIds.map(String)))];
  const results = await Result.find({ studentId: { $in: allStudentIds }, published: true }).select("studentId percentage finalScore category createdAt").lean();
  const byStudent = new Map<string, any[]>();
  for (const result of results) { const key = String(result.studentId); byStudent.set(key, [...(byStudent.get(key) || []), result]); }
  const scores = results.map((r) => Number(r.percentage ?? r.finalScore ?? 0)).filter(Number.isFinite);
  const average = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const batchesData = batches.map((b) => {
    const ids = b.studentIds.map(String);
    const cohortScores = ids.flatMap((id) => (byStudent.get(id) || []).map((r) => Number(r.percentage ?? r.finalScore ?? 0))).filter(Number.isFinite);
    const active = ids.filter((id) => byStudent.has(id)).length;
    return { id: String(b._id), name: b.name, students: ids.length, activeStudents: active, attempts: cohortScores.length, averageScore: cohortScores.length ? Number((cohortScores.reduce((a, s) => a + s, 0) / cohortScores.length).toFixed(2)) : 0, completionRate: ids.length ? Number(((active / ids.length) * 100).toFixed(2)) : 0 };
  });
  return { teacherId, cohort: batchId || "all", students: allStudentIds.length, attempts: results.length, averageScore: Number(average.toFixed(2)), batches: batchesData };
}
