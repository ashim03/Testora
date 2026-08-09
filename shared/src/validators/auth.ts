import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[0-9]/, "Password must contain a number")
  .regex(/[^A-Za-z0-9]/, "Password must contain a special character");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("A valid email is required")
  .max(191);

export const idSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

export const paginationQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional().default(""),
  sort: z.string().optional().default("-createdAt"),
  status: z.string().optional(),
  category: z.string().optional(),
  teacherId: z.string().optional(),
  batchId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const nameField = z
  .string()
  .trim()
  .min(2, "Must be at least 2 characters")
  .max(60);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, "Invalid token"),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

export const GENDERS = ["MALE", "FEMALE", "OTHER", ""] as const;

export const updateProfileSchema = z.object({
  firstName: nameField.optional(),
  lastName: nameField.optional(),
  email: emailSchema.optional(),
  phone: z.string().trim().max(30).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  gender: z.enum(GENDERS as unknown as [string, ...string[]]).optional(),
  address: z.string().trim().max(300).optional().nullable(),
  country: z.string().trim().max(80).optional().nullable(),
  timezone: z.string().trim().max(80).optional().nullable(),
  examType: z.enum(["IELTS", "PTE", ""]).optional(),
  targetScore: z.string().trim().max(20).optional().nullable(),
  currentLevel: z.string().trim().max(60).optional().nullable(),
  preferredTestDate: z.string().optional().nullable(),
});

export const brandingSchema = z.object({
  name: z.string().trim().min(2).max(120),
  tagline: z.string().trim().max(200).optional().default(""),
  address: z.string().trim().max(300).optional().nullable(),
  email: emailSchema.optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  website: z.string().trim().max(200).optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  social: z
    .object({
      facebook: z.string().trim().max(200).optional(),
      twitter: z.string().trim().max(200).optional(),
      instagram: z.string().trim().max(200).optional(),
      linkedin: z.string().trim().max(200).optional(),
    })
    .optional()
    .default({}),
});

const userBase = {
  firstName: nameField,
  lastName: nameField,
  email: emailSchema,
  phone: z.string().trim().max(30).optional().nullable().default(null),
};

export const createUserSchema = z.object({
  ...userBase,
  role: z.enum(["SUPER_ADMIN", "TEACHER", "STUDENT"]),
  password: passwordSchema,
  teacherId: z.string().optional().nullable(),
  batchId: z.string().optional().nullable(),
});

export const updateUserSchema = z
  .object({
    ...userBase,
    avatarUrl: z.string().url().optional().nullable(),
    status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
  })
  .partial();

export const createTeacherSchema = createUserSchema.extend({
  role: z.literal("TEACHER"),
  qualification: z.string().max(300).optional(),
});

export const createStudentSchema = createUserSchema.extend({
  role: z.literal("STUDENT"),
  teacherId: z.string().optional().nullable(),
  batchId: z.string().optional().nullable(),
});

export const updateTeacherSchema = updateUserSchema.extend({
  qualification: z.string().max(300).optional(),
});

export const updateStudentSchema = updateUserSchema.extend({
  teacherId: z.string().optional().nullable(),
  batchId: z.string().optional().nullable(),
});

export const assignStudentSchema = z.object({
  studentIds: z.array(idSchema).min(1, "At least one student is required"),
  teacherId: idSchema,
});

export const transferStudentSchema = z.object({
  assignmentId: idSchema,
  teacherId: idSchema,
});

export const createCourseSchema = z.object({
  name: nameField,
  code: z.string().trim().min(1).max(40),
  type: z.enum(["IELTS", "PTE"]),
  description: z.string().max(1000).optional().default(""),
});

export const createBatchSchema = z.object({
  name: nameField,
  courseId: idSchema,
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
  description: z.string().max(1000).optional().default(""),
});

export const categorySchema = z.object({
  name: nameField,
  code: z.string().trim().min(1).max(40).optional(),
  type: z.enum(["IELTS", "PTE"]).optional(),
  description: z.string().max(500).optional().default(""),
});