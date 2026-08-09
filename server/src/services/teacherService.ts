import { User, Batch, TeacherStudentAssignment, Course, Exam, ExamAttempt, Assignment, AssignmentSubmission } from "../models";
import { ApiError } from "../utils/helpers";

export async function createBatch(
  data: { name: string; courseId: string; startDate?: string; endDate?: string; description?: string },
  teacherId: string,
): Promise<unknown> {
  return Batch.create({ ...data, teacherId, studentIds: [] });
}

export async function updateBatch(id: string, data: Record<string, unknown>, teacherId: string): Promise<unknown> {
  const batch = await Batch.findById(id);
  if (!batch) throw new ApiError(404, "Batch not found");
  if (batch.teacherId && String(batch.teacherId) !== teacherId) throw new ApiError(403, "Forbidden");
  Object.assign(batch, data);
  await batch.save();
  return batch;
}

export async function deleteBatch(id: string, teacherId: string): Promise<void> {
  const batch = await Batch.findById(id);
  if (!batch) throw new ApiError(404, "Batch not found");
  if (String(batch.teacherId) !== teacherId) throw new ApiError(403, "Forbidden");
  batch.archived = true;
  await batch.save();
}

export async function listBatches(teacherId: string, courseType?: string): Promise<unknown[]> {
  const filter: Record<string, unknown> = { archived: false };
  const teacher = await User.findById(teacherId);
  if (teacher && teacher.role === "TEACHER") filter.teacherId = teacherId;
  if (courseType === "IELTS" || courseType === "PTE") {
    const courses = await Course.find({ type: courseType }).select("_id").lean();
    filter.courseId = { $in: courses.map((c) => c._id) };
  }
  const batches = await Batch.find(filter).populate("courseId").sort({ createdAt: -1 });
  return batches.map((b) => ({
    ...b.toObject(),
    studentCount: (b.studentIds || []).length,
    course: b.courseId,
  }));
}

export async function addStudentsToBatch(batchId: string, studentIds: string[]): Promise<void> {
  await Batch.updateOne({ _id: batchId }, { $addToSet: { studentIds: { $each: studentIds } } });
}

export async function removeStudentFromBatch(batchId: string, studentId: string): Promise<void> {
  await Batch.updateOne({ _id: batchId }, { $pull: { studentIds: studentId } });
}

export async function teacherDashboard(teacherId: string): Promise<unknown> {
  const activeAssignments = await TeacherStudentAssignment.find({ teacherId, status: "ACTIVE", endedAt: null }).select("studentId").lean();
  const studentIds = activeAssignments.map((a) => a.studentId);
  const [studentCount, batches, exams, assignments, attempts, gradedAttempts] = await Promise.all([
    User.countDocuments({ _id: { $in: studentIds }, role: "STUDENT", deletedAt: null }),
    Batch.countDocuments({ teacherId, archived: false }),
    Exam.countDocuments({ createdBy: teacherId, deletedAt: null }),
    Assignment.countDocuments({ createdBy: teacherId, deletedAt: null }),
    ExamAttempt.countDocuments({ teacherId, status: { $in: ["SUBMITTED", "UNDER_REVIEW"] } }),
    ExamAttempt.countDocuments({ teacherId, status: { $in: ["GRADED", "PUBLISHED"] } }),
  ]);
  return {
    studentCount,
    activeBatches: batches,
    totalExams: exams,
    totalAssignments: assignments,
    pendingGrading: attempts,
    gradedAttempts,
  };
}

export async function getBatchesWithStats(teacherId: string): Promise<unknown[]> {
  const batches = await Batch.find({ teacherId, archived: false }).populate("courseId").lean();
  const out = [];
  for (const b of batches) {
    const studentIds = (b.studentIds || []).map((s) => String(s));
    const count = studentIds.length;
    out.push({ ...b, studentCount: count });
  }
  return out;
}

export async function teacherSubmissions(teacherId: string): Promise<unknown[]> {
  const assignments = await Assignment.find({ createdBy: teacherId, deletedAt: null }).select("_id").lean();
  const ids = assignments.map((a) => a._id);
  return AssignmentSubmission.find({ assignmentId: { $in: ids } })
    .sort({ createdAt: -1 })
    .populate("assignmentId", "title")
    .populate("studentId", "firstName lastName email");
}

export async function teacherResults(teacherId: string): Promise<unknown[]> {
  const exams = await Exam.find({ createdBy: teacherId, deletedAt: null }).select("_id title").lean();
  const examIds = exams.map((e) => e._id);
  const map = new Map(exams.map((e) => [String(e._id), e.title]));
  const attempts = await ExamAttempt.find({ examId: { $in: examIds }, status: { $in: ["GRADED", "PUBLISHED"] } })
    .sort({ updatedAt: -1 })
    .populate("studentId", "firstName lastName email");
  return attempts.map((a) => ({
    id: a._id,
    examId: a.examId,
    examTitle: map.get(String(a.examId)) || "",
    studentId: a.studentId,
    finalScore: a.finalScore,
    objectiveScore: a.objectiveScore,
    subjectiveScore: a.subjectiveScore,
    maxScore: a.maxScore,
    practiceBand: a.practiceBand,
    estimatedPteScore: a.estimatedPteScore,
    status: a.status,
    createdAt: a.createdAt,
  }));
}