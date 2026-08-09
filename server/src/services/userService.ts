import { Types } from "mongoose";
import {
  User,
  TeacherProfile,
  StudentProfile,
  TeacherStudentAssignment,
  Batch,
} from "../models";
import { hashPassword } from "../utils/tokens";
import { ApiError, parseSort } from "../utils/helpers";
import { logActivity, audit, notify } from "./notificationService";

type Role = "SUPER_ADMIN" | "TEACHER" | "STUDENT";
type Status = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export interface CreateUserData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  role: Role;
  password: string;
  teacherId?: string | null;
  batchId?: string | null;
  qualification?: string;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  dateOfBirth?: Date | string | null;
  gender?: string | null;
  address?: string | null;
  country?: string | null;
  timezone?: string | null;
  status?: Status;
  teacherId?: string | null;
  batchId?: string | null;
}

export interface ListQuery {
  page?: string | number;
  limit?: string | number;
  search?: string;
  sort?: string;
  status?: string;
  teacherId?: string;
}

export const isTeacherOfStudent = async (teacherId: string, studentId: string): Promise<boolean> => {
  const exists = await TeacherStudentAssignment.exists({ teacherId, studentId, status: "ACTIVE", endedAt: null });
  return !!exists;
};

export const verifyTeacherOwnership = isTeacherOfStudent;

export const studentIdsOfTeacher = async (teacherId: string): Promise<Types.ObjectId[]> => {
  const rows = await TeacherStudentAssignment.find({ teacherId, status: "ACTIVE", endedAt: null })
    .select("studentId")
    .lean();
  return rows.map((r) => r.studentId);
};

export const getTeacherUserId = async (userOrProfileId: string): Promise<string> => {
  const profile = await TeacherProfile.findOne({ userId: userOrProfileId }).lean();
  if (profile) return String(profile.userId);
  return userOrProfileId;
};

export async function createUser(
  data: CreateUserData,
  actor: { id: string; role: string },
  ip?: string | null,
): Promise<unknown> {
  const existing = await User.findOne({ email: data.email.toLowerCase() });
  if (existing) throw new ApiError(409, "A user with that email already exists");
  const passwordHash = await hashPassword(data.password);
  const user = await User.create({
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email.toLowerCase(),
    phone: data.phone ?? null,
    role: data.role,
    passwordHash,
    status: "ACTIVE",
    createdBy: actor.id,
  });
  if (data.role === "TEACHER") {
    await TeacherProfile.create({ userId: user._id, qualification: data.qualification || "" });
  }
  if (data.role === "STUDENT") {
    await StudentProfile.create({
      userId: user._id,
      currentTeacherId: data.teacherId ? new Types.ObjectId(data.teacherId) : null,
      currentBatchId: data.batchId ? new Types.ObjectId(data.batchId) : null,
    });
    if (data.teacherId) {
      await TeacherStudentAssignment.create({
        teacherId: data.teacherId,
        studentId: user._id,
        assignedBy: actor.id,
        assignedAt: new Date(),
        status: "ACTIVE",
      });
    }
    if (data.batchId) {
      await Batch.updateOne({ _id: data.batchId }, { $addToSet: { studentIds: user._id } });
    }
  }
  await audit("CREATE_USER", {
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "User",
    entityId: String(user._id),
    after: { email: user.email, role: user.role },
  });
  await notify(
    String(user._id),
    "ACCOUNT_CREATED",
    "Account created",
    `Welcome ${data.firstName}! Your account has been created.`,
  );
  await logActivity(actor.id, "CREATE_USER", "User", user._id, { email: user.email }, ip);
  return formatUser(user);
}

export async function listUsers(
  role: Role,
  query: ListQuery,
  scope?: { teacherId?: string },
): Promise<{ data: unknown[]; total: number; page: number; limit: number; pages: number }> {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const filter: Record<string, unknown> = { role, deletedAt: null };
  if (query.status) filter.status = query.status;
  if (role === "STUDENT" && scope?.teacherId) {
    const ids = await studentIdsOfTeacher(scope.teacherId);
    filter._id = { $in: ids };
  }
  if (query.search) {
    const re = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ firstName: re }, { lastName: re }, { email: re }];
  }
  const total = await User.countDocuments(filter);
  const sort = parseSort(query.sort || "-createdAt", ["createdAt", "firstName", "lastName", "email", "status"]);
  const users = await User.find(filter).sort(sort).skip((page - 1) * limit).limit(limit);
  const data: unknown[] = [];
  for (const u of users) {
    const enriched = formatUser(u);
    if (role === "STUDENT") {
      const profile = await StudentProfile.findOne({ userId: u._id }).lean();
      const assignment = await TeacherStudentAssignment.findOne({ studentId: u._id, status: "ACTIVE", endedAt: null }).lean();
      data.push({
        ...enriched,
        batchId: profile?.currentBatchId ?? null,
        teacherId: assignment?.teacherId ?? profile?.currentTeacherId ?? null,
        assignmentId: assignment?._id ?? null,
      });
    } else if (role === "TEACHER") {
      const profile = await TeacherProfile.findOne({ userId: u._id }).lean();
      data.push({ ...enriched, qualification: profile?.qualification || "" });
    } else {
      data.push(enriched);
    }
  }
  return { data, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getUserById(id: string, role?: Role): Promise<unknown> {
  const user = await User.findOne({ _id: id, deletedAt: null });
  if (!user) throw new ApiError(404, "User not found");
  const base = formatUser(user);
  if (role === "STUDENT" || user.role === "STUDENT") {
    const profile = await StudentProfile.findOne({ userId: user._id }).lean();
    const assignment = await TeacherStudentAssignment.findOne({ studentId: user._id, status: "ACTIVE", endedAt: null }).lean();
    return {
      ...base,
      batchId: profile?.currentBatchId ?? null,
      teacherId: assignment?.teacherId ?? profile?.currentTeacherId ?? null,
      assignmentId: assignment?._id ?? null,
    };
  }
  if (role === "TEACHER" || user.role === "TEACHER") {
    const profile = await TeacherProfile.findOne({ userId: user._id }).lean();
    const count = await TeacherStudentAssignment.countDocuments({ teacherId: user._id, status: "ACTIVE", endedAt: null });
    return { ...base, qualification: profile?.qualification || "", activeStudentCount: count };
  }
  return base;
}

export async function updateUser(id: string, data: UpdateUserData, actor: { id: string; role: string }, ip?: string | null): Promise<unknown> {
  const user = await User.findById(id);
  if (!user || user.deletedAt) throw new ApiError(404, "User not found");
  const before = { email: user.email, firstName: user.firstName, lastName: user.lastName, status: user.status };
  if (data.firstName) user.firstName = data.firstName;
  if (data.lastName) user.lastName = data.lastName;
  if (data.phone !== undefined) user.phone = data.phone;
  if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl;
  if (data.dateOfBirth !== undefined) user.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
  if (data.gender !== undefined) user.gender = data.gender || null;
  if (data.address !== undefined) user.address = data.address;
  if (data.country !== undefined) user.country = data.country;
  if (data.timezone !== undefined) user.timezone = data.timezone;
  if (data.email && data.email.toLowerCase() !== user.email) {
    const dup = await User.findOne({ email: data.email.toLowerCase() });
    if (dup) throw new ApiError(409, "Email already in use");
    user.email = data.email.toLowerCase();
  }
  if (data.status) {
    if (user.role === "SUPER_ADMIN" && data.status !== "ACTIVE") {
      throw new ApiError(400, "Super admin account cannot be deactivated");
    }
    user.status = data.status;
  }
  await user.save();
  if (user.role === "STUDENT") {
    const profile = await StudentProfile.findOne({ userId: user._id });
    const patch: Record<string, unknown> = {};
    if (data.teacherId) {
      patch.currentTeacherId = new Types.ObjectId(data.teacherId);
      await endActiveAssignments(String(user._id));
      await TeacherStudentAssignment.create({
        teacherId: data.teacherId,
        studentId: user._id,
        assignedBy: actor.id,
        assignedAt: new Date(),
        status: "ACTIVE",
      });
    }
    if (data.batchId) {
      patch.currentBatchId = new Types.ObjectId(data.batchId);
      await Batch.updateOne({ _id: data.batchId }, { $addToSet: { studentIds: user._id } });
    }
    if (Object.keys(patch).length && profile) {
      Object.assign(profile, patch);
      await profile.save();
    }
  }
  await audit("UPDATE_USER", {
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "User",
    entityId: String(user._id),
    before,
    after: { email: user.email, status: user.status, firstName: user.firstName, lastName: user.lastName },
  });
  await logActivity(actor.id, "UPDATE_USER", "User", user._id, { email: user.email }, ip);
  return getUserById(id, user.role);
}

async function endActiveAssignments(studentId: string): Promise<void> {
  await TeacherStudentAssignment.updateMany(
    { studentId, status: "ACTIVE", endedAt: null },
    { $set: { status: "TRANSFERRED", endedAt: new Date() } },
  );
}

export async function updateUserStatus(
  id: string,
  status: Status,
  actor: { id: string; role: string },
  ip?: string | null,
): Promise<unknown> {
  const user = await User.findById(id);
  if (!user || user.deletedAt) throw new ApiError(404, "User not found");
  if (user.role === "SUPER_ADMIN") throw new ApiError(400, "Cannot change super admin status");
  const before = { status: user.status };
  user.status = status;
  await user.save();
  await audit("USER_STATUS", {
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "User",
    entityId: String(user._id),
    before,
    after: { status },
  });
  await logActivity(actor.id, "USER_STATUS", "User", user._id, { status }, ip);
  return formatUser(user);
}

export async function softDeleteUser(id: string, actor: { id: string; role: string }, ip?: string | null): Promise<void> {
  const user = await User.findById(id);
  if (!user || user.deletedAt) throw new ApiError(404, "User not found");
  if (user.role === "SUPER_ADMIN") throw new ApiError(400, "Cannot delete super admin");
  user.deletedAt = new Date();
  user.status = "INACTIVE";
  await user.save();
  await endActiveAssignments(String(user._id));
  await audit("DELETE_USER", {
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "User",
    entityId: String(user._id),
    after: { deletedAt: user.deletedAt.toISOString() },
  });
  await logActivity(actor.id, "DELETE_USER", "User", user._id, { email: user.email }, ip);
}

export async function resetPasswordByAdmin(
  id: string,
  newPassword: string,
  actor: { id: string; role: string },
  ip?: string | null,
): Promise<void> {
  const user = await User.findById(id);
  if (!user || user.deletedAt) throw new ApiError(404, "User not found");
  user.passwordHash = await hashPassword(newPassword);
  await user.save();
  await audit("PASSWORD_RESET", {
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "User",
    entityId: String(user._id),
  });
  await notify(String(user._id), "PASSWORD_RESET", "Password reset", "Your password has been reset by an administrator.");
  await logActivity(actor.id, "PASSWORD_RESET", "User", user._id, {}, ip);
}

export async function assignStudentsToTeacher(
  studentIds: string[],
  teacherId: string,
  actor: { id: string; role: string },
  ip?: string | null,
): Promise<void> {
  const teacher = await User.findById(teacherId);
  if (!teacher || teacher.role !== "TEACHER") throw new ApiError(400, "Invalid teacher");
  for (const studentId of studentIds) {
    const student = await User.findById(studentId);
    if (!student || student.role !== "STUDENT") throw new ApiError(400, "Invalid student");
    await endActiveAssignments(studentId);
    await TeacherStudentAssignment.create({
      teacherId,
      studentId,
      assignedBy: actor.id,
      assignedAt: new Date(),
      status: "ACTIVE",
    });
    await StudentProfile.updateOne({ userId: studentId }, { $set: { currentTeacherId: teacherId } });
    await notify(studentId, "BATCH_ASSIGNED", "Teacher assigned", `You have been assigned to teacher ${teacher.firstName} ${teacher.lastName}.`);
  }
  await audit("ASSIGN_STUDENTS", {
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "TeacherStudentAssignment",
    after: { studentIds, teacherId },
  });
  await logActivity(actor.id, "ASSIGN_STUDENTS", "User", teacherId, { studentIds }, ip);
}

export async function transferStudent(
  assignmentId: string,
  newTeacherId: string,
  actor: { id: string; role: string },
  ip?: string | null,
): Promise<void> {
  const assignment = await TeacherStudentAssignment.findById(assignmentId);
  if (!assignment || assignment.status !== "ACTIVE") throw new ApiError(404, "Assignment not found");
  const newTeacher = await User.findById(newTeacherId);
  if (!newTeacher || newTeacher.role !== "TEACHER") throw new ApiError(400, "Invalid teacher");
  assignment.status = "TRANSFERRED";
  assignment.endedAt = new Date();
  await assignment.save();
  await TeacherStudentAssignment.create({
    teacherId: newTeacherId,
    studentId: assignment.studentId,
    assignedBy: actor.id,
    assignedAt: new Date(),
    status: "ACTIVE",
  });
  await StudentProfile.updateOne(
    { userId: assignment.studentId },
    { $set: { currentTeacherId: newTeacherId } },
  );
  await audit("STUDENT_TRANSFER", {
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "TeacherStudentAssignment",
    entityId: String(assignment._id),
    before: { teacherId: assignment.teacherId },
    after: { teacherId: newTeacherId },
  });
  await logActivity(actor.id, "STUDENT_TRANSFER", "User", assignment.studentId, { newTeacherId }, ip);
}

export async function importStudentsCsv(
  rows: Array<Record<string, string>>,
  actor: { id: string; role: string },
  ip?: string | null,
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  for (const row of rows) {
    const email = (row.email || "").trim().toLowerCase();
    const firstName = (row.firstName || row["first name"] || "").trim();
    const lastName = (row.lastName || row["last name"] || "").trim();
    if (!email || !firstName || !lastName) {
      skipped += 1;
      continue;
    }
    const exists = await User.findOne({ email });
    if (exists) {
      skipped += 1;
      continue;
    }
    const password = row.password || "Student@12345";
    await createUser(
      {
        firstName,
        lastName,
        email,
        role: "STUDENT",
        password,
        teacherId: row.teacherId || null,
        batchId: row.batchId || null,
      },
      actor,
      ip,
    );
    created += 1;
  }
  return { created, skipped };
}

export async function exportStudentsCsv(students: unknown[]): Promise<string> {
  const header = "firstName,lastName,email,phone,status,teacherId,batchId\n";
  const lines = students.map((s) => {
    const r = s as Record<string, unknown>;
    return [
      String(r.firstName ?? ""),
      String(r.lastName ?? ""),
      String(r.email ?? ""),
      String(r.phone ?? ""),
      String(r.status ?? ""),
      String(r.teacherId ?? ""),
      String(r.batchId ?? ""),
    ].join(",");
  });
  return header + lines.join("\n");
}

export function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    header.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

export async function listStudentsForExport(): Promise<unknown[]> {
  const users = await User.find({ role: "STUDENT", deletedAt: null }).lean();
  const out = [];
  for (const u of users) {
    const assignment = await TeacherStudentAssignment.findOne({ studentId: u._id, status: "ACTIVE", endedAt: null }).lean();
    const profile = await StudentProfile.findOne({ userId: u._id }).lean();
    out.push({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone,
      status: u.status,
      teacherId: assignment?.teacherId ? String(assignment.teacherId) : "",
      batchId: profile?.currentBatchId ? String(profile.currentBatchId) : "",
    });
  }
  return out;
}

function formatUser(user: {
  _id: unknown;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  avatarUrl?: string | null;
  phone?: string | null;
  dateOfBirth?: Date | null;
  gender?: string | null;
  address?: string | null;
  country?: string | null;
  timezone?: string | null;
  createdAt?: Date;
}): Record<string, unknown> {
  return {
    id: String(user._id),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl || null,
    phone: user.phone || null,
    dateOfBirth: user.dateOfBirth || null,
    gender: user.gender || null,
    address: user.address || null,
    country: user.country || null,
    timezone: user.timezone || null,
    createdAt: user.createdAt,
  };
}

export const formatUserPublic = formatUser;

export interface SelfProfileData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  dateOfBirth?: Date | string | null;
  gender?: string | null;
  address?: string | null;
  country?: string | null;
  timezone?: string | null;
  examType?: string;
  targetScore?: string | null;
  currentLevel?: string | null;
  preferredTestDate?: Date | string | null;
}

export async function updateSelfProfile(userId: string, data: SelfProfileData): Promise<unknown> {
  const user = await User.findById(userId);
  if (!user || user.deletedAt) throw new ApiError(404, "User not found");
  if (data.firstName) user.firstName = data.firstName;
  if (data.lastName) user.lastName = data.lastName;
  if (data.phone !== undefined) user.phone = data.phone;
  if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl;
  if (data.dateOfBirth !== undefined) user.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
  if (data.gender !== undefined) user.gender = data.gender || null;
  if (data.address !== undefined) user.address = data.address;
  if (data.country !== undefined) user.country = data.country;
  if (data.timezone !== undefined) user.timezone = data.timezone;
  if (data.email && data.email.toLowerCase() !== user.email) {
    const dup = await User.findOne({ email: data.email.toLowerCase() });
    if (dup) throw new ApiError(409, "Email already in use");
    user.email = data.email.toLowerCase();
  }
  await user.save();

  if (user.role === "STUDENT" && (data.examType !== undefined || data.targetScore !== undefined || data.currentLevel !== undefined || data.preferredTestDate !== undefined)) {
    let profile = await StudentProfile.findOne({ userId: user._id });
    if (!profile) profile = await StudentProfile.create({ userId: user._id });
    if (data.examType !== undefined) profile.examType = data.examType;
    if (data.targetScore !== undefined) profile.targetScore = data.targetScore;
    if (data.currentLevel !== undefined) profile.currentLevel = data.currentLevel;
    if (data.preferredTestDate !== undefined) profile.preferredTestDate = data.preferredTestDate ? new Date(data.preferredTestDate) : null;
    await profile.save();
  }

  return getSelfProfile(userId);
}

export async function getSelfProfile(userId: string): Promise<Record<string, unknown>> {
  const user = await User.findOne({ _id: userId, deletedAt: null });
  if (!user) throw new ApiError(404, "User not found");
  const base = formatUser(user);
  let academic: Record<string, unknown> = {};
  if (user.role === "STUDENT") {
    const profile = await StudentProfile.findOne({ userId: user._id }).lean();
    academic = {
      examType: profile?.examType ?? profile?.enrollingCourseType ?? "",
      targetScore: profile?.targetScore ?? (profile?.targetBand != null ? String(profile.targetBand) : ""),
      currentLevel: profile?.currentLevel ?? null,
      preferredTestDate: profile?.preferredTestDate ?? null,
    };
  }
  return { ...base, ...academic };
}