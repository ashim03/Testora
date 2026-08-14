import { User, Exam, ExamAttempt, Result, TeacherStudentAssignment, Batch, Course, AuditLog, Consultancy } from "../models";

export async function adminDashboard(): Promise<unknown> {
  const [teachers, students, active, inactive, suspended, tests, attempts, results, courses, batches, consultancies, activeSubscriptions] = await Promise.all([
    User.countDocuments({ role: "TEACHER", deletedAt: null }),
    User.countDocuments({ role: "STUDENT", deletedAt: null }),
    User.countDocuments({ status: "ACTIVE", deletedAt: null }),
    User.countDocuments({ status: "INACTIVE", deletedAt: null }),
    User.countDocuments({ status: "SUSPENDED", deletedAt: null }),
    Exam.countDocuments({ deletedAt: null }),
    ExamAttempt.countDocuments({}),
    Result.find({ published: true }).lean(),
    Course.find({}).lean(),
    Batch.countDocuments({ archived: false }),
    Consultancy.countDocuments({ deletedAt: null }),
    Consultancy.countDocuments({ deletedAt: null, subscriptionStatus: "ACTIVE", subscriptionEndDate: { $gt: new Date() } }),
  ]);
  const avgPct = results.length
    ? Math.round((results.reduce((a, r) => a + (r.percentage || 0), 0) / results.length) * 100) / 100
    : 0;
  const recentRegistrations = await User.find({ deletedAt: null }).sort({ createdAt: -1 }).limit(5).select("firstName lastName email role createdAt status").lean();
  const recentActivity = await ExamAttempt.find({}).sort({ createdAt: -1 }).limit(5).populate("studentId", "firstName lastName").lean();
  const ieltsCourses = courses.filter((c) => c.type === "IELTS").length;
  const pteCourses = courses.filter((c) => c.type === "PTE").length;
  return {
    totalTeachers: teachers,
    totalStudents: students,
    activeUsers: active,
    inactiveUsers: inactive,
    suspendedUsers: suspended,
    totalTests: tests,
    testsCompleted: attempts,
    pendingGrading: await ExamAttempt.countDocuments({ status: { $in: ["SUBMITTED", "UNDER_REVIEW"] } }),
    averagePerformance: avgPct,
    recentRegistrations,
    recentActivity,
    enrollment: { ieltsCourses, pteCourses, batches },
    consultancies,
    activeSubscriptions,
    skillScores: aggregateSkillScores(results),
  };
}

function aggregateSkillScores(results: Array<{ category: string; finalScore?: number | null; maxScore?: number | null }>): Record<string, number> {
  const buckets: Record<string, { sum: number; count: number }> = {};
  for (const r of results) {
    if (r.finalScore == null) continue;
    const max = r.maxScore || r.finalScore || 1;
    const key = r.category || "OTHER";
    buckets[key] ||= { sum: 0, count: 0 };
    buckets[key].sum += (r.finalScore / max) * 100;
    buckets[key].count += 1;
  }
  return Object.fromEntries(
    Object.entries(buckets).map(([k, v]) => [k, Math.round((v.sum / v.count) * 100) / 100]),
  );
}

export async function listAuditLogs(query: { page?: number; limit?: number; action?: string }): Promise<unknown> {
  const page = query.page || 1;
  const limit = query.limit || 20;
  const filter: Record<string, unknown> = {};
  if (query.action) filter.action = query.action;
  const total = await AuditLog.countDocuments(filter);
  const data = await AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate("actorId", "firstName lastName email");
  return { data, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function listBatchesForAdmin(): Promise<unknown> {
  const batches = await Batch.find({ archived: false })
    .populate("courseId", "name code type")
    .populate("teacherId", "firstName lastName email")
    .sort({ createdAt: -1 })
    .lean() as Array<{
      _id: unknown;
      name: string;
      description?: string;
      courseId?: { _id?: unknown; name?: string; code?: string; type?: string } | null;
      teacherId?: { _id?: unknown; firstName?: string; lastName?: string; email?: string } | null;
      studentIds?: unknown[];
      startDate?: Date | null;
      endDate?: Date | null;
      createdAt?: Date;
    }>;

  const rows = batches.map((batch) => ({
    _id: String(batch._id),
    name: batch.name,
    description: batch.description || "",
    course: batch.courseId ? {
      _id: String(batch.courseId._id),
      name: batch.courseId.name || "",
      code: batch.courseId.code || "",
      type: batch.courseId.type || "",
    } : null,
    teacher: batch.teacherId ? {
      _id: String(batch.teacherId._id),
      name: `${batch.teacherId.firstName || ""} ${batch.teacherId.lastName || ""}`.trim(),
      email: batch.teacherId.email || "",
    } : null,
    studentCount: batch.studentIds?.length || 0,
    startDate: batch.startDate || null,
    endDate: batch.endDate || null,
    createdAt: batch.createdAt || null,
  }));

  const courseTypes = rows.reduce<Record<string, number>>((acc, row) => {
    const type = row.course?.type || "Unassigned";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  return {
    rows,
    summary: {
      totalBatches: rows.length,
      totalStudents: rows.reduce((sum, row) => sum + row.studentCount, 0),
      activeCourses: new Set(rows.map((row) => row.course?._id).filter(Boolean)).size,
      courseTypes,
    },
  };
}

export async function adminReports(): Promise<unknown> {
  const [students, results, batches, attempts, exams] = await Promise.all([
    User.find({ role: "STUDENT", deletedAt: null }).select("firstName lastName email createdAt").lean(),
    Result.find({ published: true }).lean(),
    Batch.find({ archived: false }).populate("courseId").lean(),
    ExamAttempt.countDocuments({}),
    Exam.countDocuments({ deletedAt: null }),
  ]);
  const performanceByStudent: Record<string, { count: number; avg: number }> = {};
  for (const r of results) {
    const key = String(r.studentId);
    performanceByStudent[key] ||= { count: 0, avg: 0 };
    performanceByStudent[key].avg += r.percentage || 0;
    performanceByStudent[key].count += 1;
  }
  const studentPerformance = students.map((s) => {
    const p = performanceByStudent[String(s._id)];
    return {
      id: String(s._id),
      name: `${s.firstName} ${s.lastName}`,
      email: s.email,
      results: p?.count || 0,
      avgPercentage: p && p.count ? Math.round((p.avg / p.count) * 100) / 100 : 0,
    };
  });
  const batchPerformance = batches.map((b) => ({
    id: String(b._id),
    name: b.name,
    course: (b.courseId as unknown as { name?: string } | null)?.name || "",
    studentCount: (b.studentIds || []).length,
  }));
  const teachers = await User.countDocuments({ role: "TEACHER", deletedAt: null });
  const totalStudents = await User.countDocuments({ role: "STUDENT", deletedAt: null });
  return {
    enrollment: { teachers, students: totalStudents },
    testsPerformed: attempts,
    testsAvailable: exams,
    completionRate: totalStudents && exams ? Math.min(100, Math.round((attempts / (exams * totalStudents)) * 10000) / 100) : 0,
    pendingGrading: await ExamAttempt.countDocuments({ status: { $in: ["SUBMITTED", "UNDER_REVIEW"] } }),
    assignedPairs: await TeacherStudentAssignment.countDocuments({ status: "ACTIVE" }),
    batchPerformance,
    studentPerformance,
    skillPerformance: aggregateSkillScores(results),
    recentRegistrations: students.slice(-5),
  };
}

export async function teacherReport(teacherId: string): Promise<unknown> {
  const studentIds = (await TeacherStudentAssignment.find({ teacherId, status: "ACTIVE", endedAt: null }).select("studentId").lean()).map((a) => a.studentId);
  const [results, attempts, studentCount] = await Promise.all([
    Result.find({ studentId: { $in: studentIds }, published: true }).lean(),
    ExamAttempt.find({ teacherId }).lean(),
    User.countDocuments({ _id: { $in: studentIds }, role: "STUDENT" }),
  ]);
  const skill = aggregateSkillScores(results);
  const trend = results.slice(0, 20).map((r) => ({ label: r.examTitle || r.category, percentage: r.percentage }));
  const avg = results.length ? Math.round(results.reduce((a, r) => a + (r.percentage || 0), 0) / results.length * 100) / 100 : 0;
  return {
    studentCount,
    resultCount: results.length,
    attemptCount: attempts.length,
    pendingGrading: attempts.filter((a) => ["SUBMITTED", "UNDER_REVIEW"].includes(a.status)).length,
    averagePerformance: avg,
    skillPerformance: skill,
    scoreTrend: trend,
  };
}
