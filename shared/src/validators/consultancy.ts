import { z } from "zod";
import { idSchema } from "./auth";
import { CONSULTANCY_STATUSES, CURRENCY } from "../constants";

export const currencySchema = z.string().trim().default(CURRENCY).refine((c) => c === "NPR", {
  message: "Only NPR is supported",
});

export const createConsultancySchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(40).toUpperCase(),
  contactName: z.string().trim().max(120).optional().nullable().default(null),
  contactEmail: z.string().trim().toLowerCase().email().max(191).optional().nullable().default(null),
  contactPhone: z.string().trim().max(30).optional().nullable().default(null),
  address: z.string().trim().max(300).optional().nullable().default(null),
});

export const updateConsultancySchema = createConsultancySchema.partial();

export const updateConsultancyStatusSchema = z.object({
  status: z.enum(CONSULTANCY_STATUSES as unknown as [string, ...string[]]),
});

export const createSubscriptionPackageSchema = z.object({
  name: z.string().trim().min(2).max(120),
  studentLimit: z.number().int().positive().max(10000),
  teacherLimit: z.number().int().positive().max(1000),
  durationDays: z.number().int().positive().max(3650),
  price: z.number().positive().max(100_000_000),
  currency: currencySchema,
  description: z.string().trim().max(500).optional().default(""),
  features: z.array(z.string().trim().max(120)).max(50).optional().default([]),
  active: z.boolean().optional().default(true),
});

export const updateSubscriptionPackageSchema = createSubscriptionPackageSchema.partial();

export const assignPackageSchema = z.object({
  packageId: idSchema,
  startDate: z.string().datetime({ offset: true }).optional(),
});

export const addConsultancyUserSchema = z.object({
  role: z.enum(["TEACHER", "STUDENT"]),
  firstName: z.string().trim().min(2).max(60),
  lastName: z.string().trim().min(2).max(60),
  email: z.string().trim().toLowerCase().email().max(191),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
  teacherId: z.string().optional().nullable(),
  batchId: z.string().optional().nullable(),
});
