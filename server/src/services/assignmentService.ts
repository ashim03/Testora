import { Types } from "mongoose";
import { Assignment, AssignmentSubmission, Batch } from "../models";
import { ApiError, parseSort } from "../utils/helpers";
import { notify, audit, logActivity } from "./notificationService";

export interface AssignmentQuery {
  page: number;
  limit: number;
  search?: string;
  sort?: string;
  status?: string;
}

export async function createAssignment(
  data: Record<string, unknown>,
  actor: { id: string; role: string },
  ip?: string | null,
): Promise<unknown> {
  const assignment = await Assignment.create({ ...data, createdBy: actor.id });
  const studentIds = new Set<string>();
  for (const id of (data.studentIds as string[]) || []) studentIds.add(id);
  for (const batchId of (data.batchIds as string[]) || []) {
    const batch = await Batch.findById(batchId);
    if (batch) batch.studentIds.forEach((s) => studentIds.add(String(s)));
  }
  assignment.studentIds = [...studentIds] as unknown as Types.ObjectId[];
  assignment.status = "ASSIGNED";
  await assignment.save();
  await audit("CREATE_ASSIGNMENT", {
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "Assignment",
    entityId: String(assignment._id),
    after: { title: assignment.title },
  });
  await logActivity(actor.id, "CREATE_ASSIGNMENT", "Assignment", assignment._id, { title: assignment.title }, ip);
  for (const sid of studentIds) {
    await notify(sid, "ASSIGNMENT_CREATED", "New assignment", `A new assignment "${assignment.title}" has been published.`, {
      assignmentId: String(assignment._id),
      dueAt: assignment.dueAt,
    });
  }
  return assignment;
}

export async function listAssignments(query: AssignmentQuery, teacherId: string): Promise<{
  data: unknown[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}> {
  const page = query.page || 1;
  const limit = query.limit || 10;
  const filter: Record<string, unknown> = { createdBy: teacherId, deletedAt: null };
  if (query.status) filter.status = query.status;
  if (query.search) {
    const re = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.title = re;
  }
  const sort = parseSort(query.sort || "-createdAt", ["createdAt", "title", "status", "dueAt"]);
  const total = await Assignment.countDocuments(filter);
  const data = await Assignment.find(filter).sort(sort).skip((page - 1) * limit).limit(limit);
  const ids = data.map((a) => a._id);
  const counts = await AssignmentSubmission.aggregate([
    { $match: { assignmentId: { $in: ids } } },
    {
      $group: {
        _id: "$assignmentId",
        submissions: { $sum: 1 },
        pending: { $sum: { $cond: [{ $in: ["$status", ["SUBMITTED", "RESUBMITTED", "PENDING"]] }, 1, 0] } },
        graded: { $sum: { $cond: [{ $in: ["$status", ["GRADED", "PUBLISHED"]] }, 1, 0] } },
      },
    },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c]));
  const out = data.map((a) => {
    const c = countMap.get(String(a._id)) ?? { submissions: 0, pending: 0, graded: 0 };
    const doc = typeof a.toObject === "function" ? a.toObject() : a;
    return { ...doc, submissionCount: c.submissions, pendingCount: c.pending, gradedCount: c.graded };
  });
  return { data: out, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getAssignment(id: string, teacherId: string, studentId?: string): Promise<unknown> {
  const assignment = await Assignment.findOne({ _id: id, deletedAt: null });
  if (!assignment) throw new ApiError(404, "Assignment not found");
  if (teacherId && String(assignment.createdBy) !== teacherId) throw new ApiError(403, "Forbidden");
  if (studentId && !assignment.studentIds.some((s) => String(s) === studentId)) {
    throw new ApiError(403, "Assignment not assigned to you");
  }
  return assignment;
}

export async function updateAssignment(
  id: string,
  data: Record<string, unknown>,
  actor: { id: string; role: string },
): Promise<unknown> {
  const assignment = await Assignment.findOne({ _id: id, deletedAt: null });
  if (!assignment) throw new ApiError(404, "Assignment not found");
  if (String(assignment.createdBy) !== actor.id) throw new ApiError(403, "Forbidden");
  Object.assign(assignment, data);
  if (data.studentIds || data.batchIds) {
    const studentIds = new Set<string>();
    for (const sid of (data.studentIds as string[]) || assignment.studentIds || []) studentIds.add(String(sid));
    for (const batchId of (data.batchIds as string[]) || assignment.batchIds || []) {
      const batch = await Batch.findById(batchId);
      if (batch) batch.studentIds.forEach((s) => studentIds.add(String(s)));
    }
    assignment.studentIds = [...studentIds] as unknown as Types.ObjectId[];
  }
  await assignment.save();
  await audit("UPDATE_ASSIGNMENT", {
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "Assignment",
    entityId: String(assignment._id),
    after: { title: assignment.title },
  });
  return assignment;
}

export async function deleteAssignment(id: string, actor: { id: string; role: string }): Promise<void> {
  const assignment = await Assignment.findOne({ _id: id, deletedAt: null });
  if (!assignment) throw new ApiError(404, "Assignment not found");
  if (String(assignment.createdBy) !== actor.id) throw new ApiError(403, "Forbidden");
  assignment.deletedAt = new Date();
  assignment.status = "CLOSED";
  await assignment.save();
  await audit("DELETE_ASSIGNMENT", {
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "Assignment",
    entityId: String(assignment._id),
  });
}

export async function publishAssignment(id: string, actor: { id: string; role: string }): Promise<unknown> {
  const assignment = await Assignment.findOne({ _id: id, deletedAt: null });
  if (!assignment) throw new ApiError(404, "Assignment not found");
  if (String(assignment.createdBy) !== actor.id) throw new ApiError(403, "Forbidden");
  assignment.published = true;
  assignment.status = "OPEN";
  await assignment.save();
  for (const sid of assignment.studentIds) {
    await notify(String(sid), "ASSIGNMENT_CREATED", "Assignment published", `"${assignment.title}" is now open for submission.`, { assignmentId: String(assignment._id), dueAt: assignment.dueAt });
  }
  await audit("PUBLISH_ASSIGNMENT", {
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "Assignment",
    entityId: String(assignment._id),
    after: { status: "OPEN", published: true },
  });
  return assignment;
}

export async function listSubmission(assignmentId: string, query: { page?: number; limit?: number; status?: string; sort?: string }, teacherId: string): Promise<unknown> {
  const page = query.page || 1;
  const limit = query.limit || 10;
  let filter: Record<string, unknown> = {};
  if (assignmentId) {
    const assignment = await Assignment.findOne({ _id: assignmentId, deletedAt: null });
    if (!assignment) throw new ApiError(404, "Assignment not found");
    if (String(assignment.createdBy) !== teacherId) throw new ApiError(403, "Forbidden");
    filter.assignmentId = assignment._id;
  } else {
    const assignments = await Assignment.find({ createdBy: teacherId, deletedAt: null }).select("_id").lean();
    const ids = assignments.map((a) => a._id);
    filter = { assignmentId: { $in: ids } };
  }
  if (query.status) filter.status = { $in: query.status.split(",") } as never;
  const total = await AssignmentSubmission.countDocuments(filter);
  const sort = parseSort(query.sort || "-createdAt", ["createdAt", "marks", "status"]);
  const data = await AssignmentSubmission.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).populate("assignmentId").populate("studentId", "firstName lastName email");
  return { data, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getSubmission(id: string, teacherId: string): Promise<unknown> {
  const submission = await AssignmentSubmission.findById(id).populate("assignmentId").populate("studentId", "firstName lastName email");
  if (!submission) throw new ApiError(404, "Submission not found");
  const assignment = submission.assignmentId as unknown as { createdBy: Types.ObjectId };
  if (String(assignment.createdBy) !== teacherId) throw new ApiError(403, "Forbidden");
  return submission;
}

export async function gradeSubmission(
  submissionId: string,
  data: { score?: number; feedback?: string; requestResubmission?: boolean; published?: boolean; strengths?: string[]; improvements?: string[]; returnReason?: string },
  teacherId: string,
): Promise<unknown> {
  const submission = await AssignmentSubmission.findById(submissionId);
  if (!submission) throw new ApiError(404, "Submission not found");
  const assignment = await Assignment.findById(submission.assignmentId);
  if (!assignment) throw new ApiError(404, "Assignment not found");
  if (String(assignment.createdBy) !== teacherId) throw new ApiError(403, "Forbidden");
  if (data.requestResubmission) {
    submission.status = "RETURNED";
    submission.returnReason = data.returnReason || "Please review and resubmit.";
    submission.feedback = data.feedback !== undefined ? data.feedback : submission.feedback;
  } else {
    if (data.score !== undefined) {
      submission.marks = data.score;
      submission.maxMarks = assignment.maxMarks;
      submission.status = data.published ? "PUBLISHED" : "GRADED";
    }
    if (data.feedback !== undefined) submission.feedback = data.feedback;
    if (data.strengths !== undefined) submission.strengths = data.strengths;
    if (data.improvements !== undefined) submission.improvements = data.improvements;
    if (data.returnReason !== undefined) submission.returnReason = data.returnReason;
  }
  submission.gradedBy = teacherId as unknown as Types.ObjectId;
  submission.gradedAt = new Date();
  await submission.save();
  if (data.requestResubmission) {
    await notify(String(submission.studentId), "ASSIGNMENT_RETURNED", "Assignment returned for revision", `Your submission for "${assignment.title}" needs revision.`, {
      assignmentId: String(assignment._id),
      submissionId: String(submission._id),
      reason: submission.returnReason,
    });
    await audit("RETURN_ASSIGNMENT_SUBMISSION", {
      actorId: teacherId,
      actorRole: "TEACHER",
      entityType: "AssignmentSubmission",
      entityId: String(submission._id),
      after: { status: "RETURNED", reason: submission.returnReason },
    });
    return submission;
  }
  await notify(String(submission.studentId), "ASSIGNMENT_GRADED", "Assignment graded", `Your submission for "${assignment.title}" has been graded.`, {
    assignmentId: String(assignment._id),
    submissionId: String(submission._id),
    marks: submission.marks,
    maxMarks: assignment.maxMarks,
  });
  await audit("GRADE_ASSIGNMENT_SUBMISSION", {
    actorId: teacherId,
    actorRole: "TEACHER",
    entityType: "AssignmentSubmission",
    entityId: String(submission._id),
    after: { marks: submission.marks, status: submission.status },
  });
  return submission;
}

export async function studentAssignments(studentId: string, query: { page?: number; limit?: number }): Promise<unknown> {
  const page = query.page || 1;
  const limit = query.limit || 10;
  const filter: Record<string, unknown> = { studentIds: studentId, deletedAt: null, status: { $in: ["ASSIGNED", "OPEN"] } };
  const total = await Assignment.countDocuments(filter);
  const data = await Assignment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
  const enriched = [];
  for (const a of data) {
    const submission = await AssignmentSubmission.findOne({ assignmentId: a._id, studentId }).lean();
    enriched.push({ assignment: a, submission });
  }
  return { data: enriched, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function submitAssignment(assignmentId: string, studentId: string, data: { content?: string; files?: string[]; link?: string }): Promise<unknown> {
  const assignment = await Assignment.findOne({ _id: assignmentId, deletedAt: null });
  if (!assignment) throw new ApiError(404, "Assignment not found");
  if (!assignment.studentIds.some((s) => String(s) === studentId)) throw new ApiError(403, "Assignment not assigned to you");
  const link = (data.link || "").trim();
  const content = [data.content || "", link ? `Submission link: ${link}` : ""].filter(Boolean).join("\n\n");
  const existing = await AssignmentSubmission.findOne({ assignmentId, studentId });
  if (existing) {
    if (content) existing.content = content;
    if (data.files) existing.files = data.files;
    existing.submittedAt = new Date();
    existing.isDraft = false;
    existing.status = existing.status === "RETURNED" || existing.status === "RESUBMITTED" ? "RESUBMITTED" : "SUBMITTED";
    await existing.save();
    await notify(studentId, "SUBMISSION_SUCCESS", "Assignment submitted", `You submitted "${assignment.title}".`, {
      assignmentId: String(assignment._id),
      submissionId: String(existing._id),
    });
    await notify(String(assignment.createdBy), "SUBMISSION_RECEIVED", "New submission", `"${assignment.title}" has a new submission.`, { assignmentId: String(assignment._id), studentId });
    return existing;
  }
  const submission = await AssignmentSubmission.create({
    assignmentId,
    studentId,
    content,
    files: data.files || [],
    submittedAt: new Date(),
    isDraft: false,
    status: "SUBMITTED",
    teacherId: assignment.createdBy,
  });
  await notify(studentId, "SUBMISSION_SUCCESS", "Assignment submitted", `You submitted "${assignment.title}".`, {
    assignmentId: String(assignment._id),
    submissionId: String(submission._id),
  });
  await notify(String(assignment.createdBy), "SUBMISSION_RECEIVED", "New submission", `"${assignment.title}" has a new submission.`, { assignmentId: String(assignment._id), studentId });
  return submission;
}
