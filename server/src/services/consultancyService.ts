import crypto from "crypto";
import { Types } from "mongoose";
import {
  Consultancy,
  SubscriptionPackage,
  User,
  TeacherProfile,
  StudentProfile,
  TeacherStudentAssignment,
  Batch,
  Course,
  Exam,
} from "../models";
import { hashPassword } from "../utils/tokens";
import { ApiError, parseSort } from "../utils/helpers";
import { audit, logActivity, notify } from "./notificationService";
import { CURRENCY } from "@testora-platform/shared";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CreateConsultancyData {
  name: string;
  code: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
}

function generatePassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let p = "";
  for (let i = 0; i < 12; i++) p += chars[crypto.randomInt(0, chars.length)];
  p += "!1A";
  return p;
}

async function consultancyWithCounts(c: Record<string, any>) {
  const [teacherCount, studentCount] = await Promise.all([
    User.countDocuments({ consultancyId: c._id, role: "TEACHER", deletedAt: null }),
    User.countDocuments({ consultancyId: c._id, role: "STUDENT", deletedAt: null }),
  ]);
  let pkg: Record<string, unknown> | null = null;
  if (c.packageId) {
    const p = await SubscriptionPackage.findById(c.packageId).lean();
    if (p) {
      pkg = {
        id: String(p._id),
        name: p.name,
        studentLimit: p.studentLimit,
        teacherLimit: p.teacherLimit,
        durationDays: p.durationDays,
        price: p.price,
        currency: p.currency,
        description: p.description,
        features: p.features,
      };
    }
  }
  const now = Date.now();
  const subscriptionActive =
    c.subscriptionStatus === "ACTIVE" && (!c.subscriptionEndDate || new Date(c.subscriptionEndDate).getTime() > now);
  return {
    id: String(c._id),
    name: c.name,
    code: c.code,
    contactName: c.contactName,
    contactEmail: c.contactEmail,
    contactPhone: c.contactPhone,
    address: c.address,
    status: c.status,
    package: pkg,
    subscriptionStatus: subscriptionActive ? "ACTIVE" : c.subscriptionStatus,
    subscriptionStartDate: c.subscriptionStartDate,
    subscriptionEndDate: c.subscriptionEndDate,
    studentLimit: c.studentLimit ?? (pkg?.studentLimit as number | null) ?? null,
    teacherLimit: c.teacherLimit ?? (pkg?.teacherLimit as number | null) ?? null,
    teacherCount,
    studentCount,
    daysLeft: c.subscriptionEndDate
      ? Math.max(0, Math.ceil((new Date(c.subscriptionEndDate).getTime() - now) / DAY_MS))
      : 0,
    createdAt: c.createdAt,
  };
}

export async function createConsultancy(data: CreateConsultancyData, actor: { id: string; role: string }, ip?: string | null) {
  const code = data.code.toUpperCase();
  const existing = await Consultancy.findOne({ code });
  if (existing) throw new ApiError(409, "A consultancy with that code already exists");

  const accountEmail = (data.contactEmail || `${data.code.toLowerCase()}@consultancy.local`).trim().toLowerCase();
  const emailTaken = await User.findOne({ email: accountEmail });
  if (emailTaken) throw new ApiError(409, "A user with that email already exists");

  const password = generatePassword();
  const consultancy = await Consultancy.create({
    name: data.name,
    code,
    contactName: data.contactName ?? null,
    contactEmail: data.contactEmail ?? null,
    contactPhone: data.contactPhone ?? null,
    address: data.address ?? null,
    status: "ACTIVE",
    subscriptionStatus: "TRIAL",
    createdBy: actor.id,
  });

  const passwordHash = await hashPassword(password);
  const account = await User.create({
    firstName: data.name,
    lastName: "Consultancy",
    email: accountEmail,
    passwordHash,
    role: "CONSULTANCY",
    status: "ACTIVE",
    consultancyId: consultancy._id,
    createdBy: actor.id,
  });

  await audit("CREATE_CONSULTANCY", {
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "Consultancy",
    entityId: String(consultancy._id),
    after: { name: consultancy.name, code: consultancy.code, email: accountEmail },
  });
  await logActivity(actor.id, "CREATE_CONSULTANCY", "Consultancy", consultancy._id, { name: consultancy.name }, ip);
  await notify(
    String(account._id),
    "ACCOUNT_CREATED",
    "Consultancy account created",
    `Your consultancy "${data.name}" is active. Sign in with ${accountEmail}.`,
  );

  const enriched = await consultancyWithCounts(consultancy.toObject());
  return { ...enriched, account: { id: String(account._id), email: accountEmail, temporaryPassword: password } };
}

export async function listConsultancies(query: { page?: string | number; limit?: string | number; search?: string; sort?: string; status?: string }) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const filter: Record<string, unknown> = { deletedAt: null };
  if (query.status) filter.status = query.status;
  if (query.search) {
    const re = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: re }, { code: re }, { contactEmail: re }];
  }
  const total = await Consultancy.countDocuments(filter);
  const sort = parseSort(query.sort || "-createdAt", ["createdAt", "name", "code", "status"]);
  const rows = await Consultancy.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean();
  const data = [];
  for (const r of rows) data.push(await consultancyWithCounts(r));
  return { data, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getConsultancy(id: string) {
  const c = await Consultancy.findOne({ _id: id, deletedAt: null });
  if (!c) throw new ApiError(404, "Consultancy not found");
  return consultancyWithCounts(c.toObject());
}

export async function updateConsultancy(id: string, data: Partial<CreateConsultancyData>) {
  const c = await Consultancy.findById(id);
  if (!c || c.deletedAt) throw new ApiError(404, "Consultancy not found");
  if (data.name) c.name = data.name;
  if (data.contactName !== undefined) c.contactName = data.contactName;
  if (data.contactEmail !== undefined) c.contactEmail = data.contactEmail;
  if (data.contactPhone !== undefined) c.contactPhone = data.contactPhone;
  if (data.address !== undefined) c.address = data.address;
  if (data.code) {
    const upper = data.code.toUpperCase();
    if (upper !== c.code) {
      const dup = await Consultancy.findOne({ code: upper });
      if (dup) throw new ApiError(409, "Code already in use");
      c.code = upper;
    }
  }
  await c.save();
  return getConsultancy(id);
}

export async function setConsultancyStatus(id: string, status: "ACTIVE" | "INACTIVE" | "SUSPENDED", actor: { id: string; role: string }, ip?: string | null) {
  const c = await Consultancy.findById(id);
  if (!c || c.deletedAt) throw new ApiError(404, "Consultancy not found");
  c.status = status;
  await c.save();
  const userStatus = status === "ACTIVE" ? "ACTIVE" : status === "INACTIVE" ? "INACTIVE" : "SUSPENDED";
  await User.updateMany(
    { consultancyId: c._id },
    status === "SUSPENDED" ? { $set: { status: userStatus } } : { $set: { status: userStatus } },
  );
  await audit("CONSULTANCY_STATUS", {
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "Consultancy",
    entityId: String(c._id),
    before: {},
    after: { status },
  });
  await logActivity(actor.id, "CONSULTANCY_STATUS", "Consultancy", c._id, { status }, ip);
  return getConsultancy(id);
}

export async function deleteConsultancy(id: string, actor: { id: string; role: string }, ip?: string | null) {
  const c = await Consultancy.findById(id);
  if (!c || c.deletedAt) throw new ApiError(404, "Consultancy not found");
  c.deletedAt = new Date();
  c.status = "INACTIVE";
  await c.save();
  await User.updateMany({ consultancyId: c._id }, { $set: { status: "INACTIVE" } });
  await audit("DELETE_CONSULTANCY", {
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "Consultancy",
    entityId: String(c._id),
    after: { deletedAt: c.deletedAt.toISOString() },
  });
  await logActivity(actor.id, "DELETE_CONSULTANCY", "Consultancy", c._id, { name: c.name }, ip);
}

export async function createSubscriptionPackage(data: {
  name: string;
  studentLimit: number;
  teacherLimit: number;
  durationDays: number;
  price: number;
  currency?: string;
  description?: string;
  features?: string[];
  active?: boolean;
}, actor: { id: string; role: string }, ip?: string | null) {
  const pkg = await SubscriptionPackage.create({
    name: data.name,
    studentLimit: data.studentLimit,
    teacherLimit: data.teacherLimit,
    durationDays: data.durationDays,
    price: data.price,
    currency: data.currency || CURRENCY,
    description: data.description || "",
    features: data.features || [],
    active: data.active ?? true,
    createdBy: actor.id,
  });
  await audit("CREATE_PACKAGE", {
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "SubscriptionPackage",
    entityId: String(pkg._id),
    after: { name: pkg.name, price: pkg.price, currency: pkg.currency },
  });
  await logActivity(actor.id, "CREATE_PACKAGE", "SubscriptionPackage", pkg._id, { name: pkg.name }, ip);
  return formatPackage(pkg);
}

export async function listSubscriptionPackages(query: { page?: string | number; limit?: string | number; search?: string; sort?: string; active?: string }) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 100);
  const filter: Record<string, unknown> = { deletedAt: null };
  if (query.active) filter.active = query.active === "true";
  if (query.search) {
    const re = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.name = re;
  }
  const total = await SubscriptionPackage.countDocuments(filter);
  const sort = parseSort(query.sort || "-createdAt", ["createdAt", "name", "price", "studentLimit"]);
  const pkgs = await SubscriptionPackage.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean();
  return {
    data: pkgs.map(formatPackage),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

export async function updateSubscriptionPackage(id: string, data: Partial<{
  name: string;
  studentLimit: number;
  teacherLimit: number;
  durationDays: number;
  price: number;
  currency: string;
  description: string;
  features: string[];
  active: boolean;
}>) {
  const pkg = await SubscriptionPackage.findById(id);
  if (!pkg || pkg.deletedAt) throw new ApiError(404, "Package not found");
  if (data.name !== undefined) pkg.name = data.name;
  if (data.studentLimit !== undefined) pkg.studentLimit = data.studentLimit;
  if (data.teacherLimit !== undefined) pkg.teacherLimit = data.teacherLimit;
  if (data.durationDays !== undefined) pkg.durationDays = data.durationDays;
  if (data.price !== undefined) pkg.price = data.price;
  if (data.currency !== undefined) pkg.currency = data.currency;
  if (data.description !== undefined) pkg.description = data.description;
  if (data.features !== undefined) pkg.features = data.features;
  if (data.active !== undefined) pkg.active = data.active;
  await pkg.save();
  return formatPackage(pkg);
}

export async function deleteSubscriptionPackage(id: string) {
  const pkg = await SubscriptionPackage.findById(id);
  if (!pkg || pkg.deletedAt) throw new ApiError(404, "Package not found");
  const inUse = await Consultancy.countDocuments({ packageId: pkg._id, deletedAt: null });
  if (inUse > 0) throw new ApiError(400, "Cannot delete a package that is in use by a consultancy");
  pkg.deletedAt = new Date();
  pkg.active = false;
  await pkg.save();
}

export async function assignPackageToConsultancy(consultancyId: string, packageId: string, startDate?: string, actor?: { id: string; role: string }, ip?: string | null) {
  const c = await Consultancy.findById(consultancyId);
  if (!c || c.deletedAt) throw new ApiError(404, "Consultancy not found");
  const pkg = await SubscriptionPackage.findById(packageId);
  if (!pkg || pkg.deletedAt || !pkg.active) throw new ApiError(400, "Invalid or inactive package");

  const start = startDate ? new Date(startDate) : new Date();
  if (Number.isNaN(start.getTime())) throw new ApiError(400, "Invalid start date");
  const end = new Date(start.getTime() + pkg.durationDays * DAY_MS);

  c.packageId = pkg._id as any;
  c.subscriptionStatus = "ACTIVE";
  c.subscriptionStartDate = start;
  c.subscriptionEndDate = end;
  c.studentLimit = pkg.studentLimit;
  c.teacherLimit = pkg.teacherLimit;
  await c.save();

  const account = await User.findOne({ consultancyId: c._id, role: "CONSULTANCY" });
  if (account) {
    await notify(
      String(account._id),
      "SUBSCRIPTION_UPDATED",
      "Subscription activated",
      `Your subscription for "${pkg.name}" is active until ${end.toDateString()}.`,
    );
  }

  if (actor) {
    await audit("ASSIGN_PACKAGE", {
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "Consultancy",
      entityId: String(c._id),
      before: { packageId: c.packageId ? String(c.packageId) : null },
      after: { packageId: String(pkg._id), price: pkg.price, currency: pkg.currency, endDate: end.toISOString() },
    });
    await logActivity(actor.id, "ASSIGN_PACKAGE", "Consultancy", c._id, { packageId: String(pkg._id) }, ip);
  }

  return getConsultancy(consultancyId);
}

export async function listSubscriptions() {
  const rows = await Consultancy.find({ deletedAt: null }).sort({ createdAt: -1 }).lean();
  const data = [];
  for (const r of rows) data.push(await consultancyWithCounts(r));
  return data;
}

export async function getConsultancyByUserId(userId: string) {
  const account = await User.findOne({ _id: userId, role: "CONSULTANCY", deletedAt: null });
  if (!account || !account.consultancyId) throw new ApiError(403, "Not a consultancy account");
  return getConsultancy(String(account.consultancyId));
}

export async function assertCapacity(consultancyId: string, role: "TEACHER" | "STUDENT") {
  const c = await Consultancy.findOne({ _id: consultancyId, deletedAt: null });
  if (!c) throw new ApiError(404, "Consultancy not found");
  const active = c.subscriptionStatus === "ACTIVE" && (!c.subscriptionEndDate || new Date(c.subscriptionEndDate).getTime() > Date.now());
  if (!active) throw new ApiError(403, "Consultancy subscription is not active");
  const limit = role === "TEACHER" ? c.teacherLimit : c.studentLimit;
  if (!limit) throw new ApiError(400, "No capacity configured for this consultancy");
  const used = await User.countDocuments({ consultancyId: c._id, role, deletedAt: null });
  if (used >= limit) {
    throw new ApiError(
      409,
      `${role === "TEACHER" ? "Teacher" : "Student"} limit reached (${used}/${limit}). Upgrade your subscription package.`,
    );
  }
}

export async function createConsultancyUser(
  consultancyId: string,
  data: {
    role: "TEACHER" | "STUDENT";
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    teacherId?: string | null;
    batchId?: string | null;
    qualification?: string;
  },
  actor: { id: string; role: string },
  ip?: string | null,
) {
  await assertCapacity(consultancyId, data.role);
  const existing = await User.findOne({ email: data.email.toLowerCase() });
  if (existing) throw new ApiError(409, "A user with that email already exists");
  const passwordHash = await hashPassword(data.password);
  const user = await User.create({
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email.toLowerCase(),
    phone: null,
    role: data.role,
    passwordHash,
    status: "ACTIVE",
    consultancyId: new Types.ObjectId(consultancyId),
    createdBy: actor.id,
  });
  if (data.role === "TEACHER") {
    await TeacherProfile.create({ userId: user._id, qualification: data.qualification || "" });
  } else {
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
  await notify(String(user._id), "ACCOUNT_CREATED", "Account created", `Welcome ${data.firstName}! Your account has been created.`);
  await logActivity(actor.id, "CREATE_USER", "User", user._id, { email: user.email }, ip);
  return {
    id: String(user._id),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
  };
}

export async function listConsultancyUsers(
  consultancyId: string,
  role: "TEACHER" | "STUDENT",
  query: { page?: string | number; limit?: string | number; search?: string; sort?: string; status?: string; teacherId?: string },
) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const filter: Record<string, unknown> = { role, deletedAt: null, consultancyId: new Types.ObjectId(consultancyId) };
  if (query.status) filter.status = query.status;
  if (role === "STUDENT" && query.teacherId) {
    const assignment = await TeacherStudentAssignment.find({ teacherId: query.teacherId, status: "ACTIVE", endedAt: null }).select("studentId").lean();
    const ids = assignment.map((a) => a.studentId);
    filter._id = { $in: ids };
  }
  if (query.search) {
    const re = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ firstName: re }, { lastName: re }, { email: re }];
  }
  const total = await User.countDocuments(filter);
  const sort = parseSort(query.sort || "-createdAt", ["createdAt", "firstName", "lastName", "email", "status"]);
  const users = await User.find(filter).sort(sort).skip((page - 1) * limit).limit(limit);
  const data = [];
  for (const u of users) {
    const base = {
      id: String(u._id),
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
    };
    if (role === "STUDENT") {
      const profile = await StudentProfile.findOne({ userId: u._id }).lean();
      const assignment = await TeacherStudentAssignment.findOne({ studentId: u._id, status: "ACTIVE", endedAt: null }).lean();
      data.push({ ...base, batchId: profile?.currentBatchId ?? null, teacherId: assignment?.teacherId ?? profile?.currentTeacherId ?? null });
    } else {
      const profile = await TeacherProfile.findOne({ userId: u._id }).lean();
      const count = await TeacherStudentAssignment.countDocuments({ teacherId: u._id, status: "ACTIVE", endedAt: null });
      data.push({ ...base, qualification: profile?.qualification || "", activeStudentCount: count });
    }
  }
  return { data, total, page, limit, pages: Math.ceil(total / limit) };
}

function formatPackage(pkg: Record<string, any>): Record<string, unknown> {
  return {
    id: String(pkg._id),
    name: pkg.name,
    studentLimit: pkg.studentLimit,
    teacherLimit: pkg.teacherLimit,
    durationDays: pkg.durationDays,
    price: pkg.price,
    currency: pkg.currency,
    description: pkg.description,
    features: pkg.features || [],
    active: pkg.active,
    createdAt: pkg.createdAt,
  };
}

export const formatConsultancyWithCounts = consultancyWithCounts;

async function teacherIdsOfConsultancy(consultancyId: string): Promise<Types.ObjectId[]> {
  const teachers = await User.find({ consultancyId: new Types.ObjectId(consultancyId), role: "TEACHER", deletedAt: null })
    .select("_id")
    .lean();
  return teachers.map((t) => t._id);
}

export async function listConsultancyCourses(
  consultancyId: string,
  query: { page?: string | number; limit?: string | number; search?: string; type?: string; active?: string },
) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const teacherIds = await teacherIdsOfConsultancy(consultancyId);
  if (!teacherIds.length) return { data: [], total: 0, page, limit, pages: 0 };
  const filter: Record<string, unknown> = { instructorId: { $in: teacherIds }, deletedAt: null };
  if (query.type) filter.type = query.type;
  if (query.active === "true") filter.active = true;
  if (query.active === "false") filter.active = false;
  if (query.search) {
    const re = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.name = re;
  }
  const total = await Course.countDocuments(filter);
  const data = await Course.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("instructorId", "firstName lastName email")
    .lean();
  return { data, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function listConsultancyExams(
  consultancyId: string,
  query: { page?: string | number; limit?: string | number; search?: string; type?: string; category?: string; status?: string },
) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);
  const teacherIds = await teacherIdsOfConsultancy(consultancyId);
  if (!teacherIds.length) return { data: [], total: 0, page, limit, pages: 0 };
  const filter: Record<string, unknown> = { createdBy: { $in: teacherIds }, deletedAt: null };
  if (query.type) filter.type = query.type;
  if (query.category) filter.category = query.category;
  if (query.status) filter.status = query.status;
  if (query.search) {
    const re = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.title = re;
  }
  const total = await Exam.countDocuments(filter);
  const data = await Exam.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("createdBy", "firstName lastName email")
    .lean();
  return { data, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function consultancyContentOverview(consultancyId: string) {
  const teacherIds = await teacherIdsOfConsultancy(consultancyId);
  if (!teacherIds.length) {
    return {
      counts: { teachers: 0, students: 0, courses: 0, activeCourses: 0, exams: 0, mockTests: 0, practiceTests: 0 },
      recentCourses: [],
      recentExams: [],
    };
  }
  const teacherFilter = { $in: teacherIds };
  const [teachers, students, courses, activeCourses, exams, mockTests, practiceTests, recentCourses, recentExams] = await Promise.all([
    User.countDocuments({ consultancyId: new Types.ObjectId(consultancyId), role: "TEACHER", deletedAt: null }),
    User.countDocuments({ consultancyId: new Types.ObjectId(consultancyId), role: "STUDENT", deletedAt: null }),
    Course.countDocuments({ instructorId: teacherFilter, deletedAt: null }),
    Course.countDocuments({ instructorId: teacherFilter, deletedAt: null, active: true }),
    Exam.countDocuments({ createdBy: teacherFilter, deletedAt: null }),
    Exam.countDocuments({ createdBy: teacherFilter, deletedAt: null, type: "MOCK" }),
    Exam.countDocuments({ createdBy: teacherFilter, deletedAt: null, type: { $in: ["PRACTICE", "SECTIONAL"] } }),
    Course.find({ instructorId: teacherFilter, deletedAt: null })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name type code active instructorId createdAt")
      .populate("instructorId", "firstName lastName")
      .lean(),
    Exam.find({ createdBy: teacherFilter, deletedAt: null })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("title category type status durationSec createdBy createdAt")
      .populate("createdBy", "firstName lastName")
      .lean(),
  ]);
  return {
    counts: {
      teachers,
      students,
      courses,
      activeCourses,
      exams,
      mockTests,
      practiceTests,
    },
    recentCourses,
    recentExams,
  };
}
