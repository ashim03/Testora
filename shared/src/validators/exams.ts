import { z } from "zod";
import { idSchema } from "./auth";
import { QUESTION_CATEGORIES } from "../constants";

const sectionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  order: z.number().int().nonnegative().default(0),
  durationSec: z.number().int().positive().optional(),
  questionIds: z.array(idSchema).default([]),
  instructions: z.string().max(2000).optional().default(""),
  audioUrl: z.string().max(1000).optional().nullable().default(null),
  audioAssetId: idSchema.optional().nullable().default(null),
  audioDuration: z.number().int().nonnegative().optional().nullable().default(null),
  audioPlayRules: z
    .object({
      maxPlays: z.number().int().min(1).max(50).optional().nullable().default(null),
      allowSeek: z.boolean().default(true),
    })
    .optional()
    .nullable()
    .default(null),
});

export const createExamSchema = z.object({
  title: z.string().trim().min(3).max(200),
  type: z.enum(["PRACTICE", "SECTIONAL", "MOCK", "CUSTOM"]).default("PRACTICE"),
  category: z.enum(QUESTION_CATEGORIES as unknown as [string, ...string[]]),
  description: z.string().max(2000).optional().default(""),
  durationSec: z.number().int().positive().max(43200).optional(),
  part: z.string().trim().max(20).optional().nullable(),
  sections: z.array(sectionSchema).max(6).default([]),
  questionIds: z.array(idSchema).default([]),
  startAt: z.string().datetime({ offset: true }).optional(),
  endAt: z.string().datetime({ offset: true }).optional(),
  attemptLimit: z.number().int().positive().max(100).default(1),
  randomizeQuestions: z.boolean().default(false),
  randomizeOptions: z.boolean().default(false),
  allowNavigation: z.boolean().default(true),
  allowReview: z.boolean().default(true),
  autoSubmit: z.boolean().default(true),
  allowLateSubmission: z.boolean().default(true),
  sectionWiseTiming: z.boolean().default(false),
  negativeMarking: z.boolean().default(false),
  showAnswersImmediately: z.boolean().default(false),
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED", "COMPLETED"]).optional(),
  passMarks: z.number().nonnegative().optional(),
});

export const updateExamSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  type: z.enum(["PRACTICE", "SECTIONAL", "MOCK", "CUSTOM"]).optional(),
  category: z.enum(QUESTION_CATEGORIES as unknown as [string, ...string[]]).optional(),
  description: z.string().max(2000).optional(),
  durationSec: z.number().int().positive().max(43200).optional(),
  part: z.string().trim().max(20).optional().nullable(),
  sections: z.array(sectionSchema).max(6).optional(),
  questionIds: z.array(idSchema).optional(),
  startAt: z.string().datetime({ offset: true }).optional().nullable(),
  endAt: z.string().datetime({ offset: true }).optional().nullable(),
  attemptLimit: z.number().int().positive().max(100).optional(),
  randomizeQuestions: z.boolean().optional(),
  randomizeOptions: z.boolean().optional(),
  allowNavigation: z.boolean().optional(),
  allowReview: z.boolean().optional(),
  autoSubmit: z.boolean().optional(),
  allowLateSubmission: z.boolean().optional(),
  sectionWiseTiming: z.boolean().optional(),
  negativeMarking: z.boolean().optional(),
  showAnswersImmediately: z.boolean().optional(),
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED", "COMPLETED"]).optional(),
  passMarks: z.number().nonnegative().optional(),
});

export const assignExamSchema = z.object({
  studentIds: z.array(idSchema).optional().default([]),
  batchIds: z.array(idSchema).optional().default([]),
});

export const gradeSubmissionSchema = z.object({
  score: z.number().nonnegative().max(1000),
  feedback: z.string().max(4000).optional().default(""),
  strengths: z.array(z.string()).max(20).optional().default([]),
  improvements: z.array(z.string()).max(20).optional().default([]),
  criteria: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        score: z.number().nonnegative().max(10),
        comment: z.string().optional().default(""),
      }),
    )
    .optional(),
  saveAsDraft: z.boolean().default(false),
  requestResubmission: z.boolean().default(false),
});

export const createAssignmentSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().max(5000).optional().default(""),
  instructions: z.string().max(5000).optional().default(""),
  examId: idSchema.optional().nullable(),
  questionIds: z.array(idSchema).optional().default([]),
  studentIds: z.array(idSchema).optional().default([]),
  batchIds: z.array(idSchema).optional().default([]),
  dueAt: z.string().datetime({ offset: true }).optional(),
  maxMarks: z.number().positive().max(1000).default(100),
  attachments: z.array(z.string().url()).optional().default([]),
  submissionType: z.enum(["TEXT", "FILE", "TEXT_AND_FILE", "LINK", "AUDIO_VIDEO"]).optional().default("TEXT"),
  allowedFileTypes: z.array(z.string()).optional().default([]),
  requiresAttachment: z.boolean().optional().default(false),
  allowResubmission: z.boolean().optional().default(true),
});

export const updateAssignmentSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().max(5000).optional(),
  instructions: z.string().max(5000).optional(),
  examId: idSchema.optional().nullable(),
  questionIds: z.array(idSchema).optional(),
  studentIds: z.array(idSchema).optional(),
  batchIds: z.array(idSchema).optional(),
  dueAt: z.string().datetime({ offset: true }).optional(),
  maxMarks: z.number().positive().max(1000).optional(),
  attachments: z.array(z.string().url()).optional(),
  submissionType: z.enum(["TEXT", "FILE", "TEXT_AND_FILE", "LINK", "AUDIO_VIDEO"]).optional(),
  allowedFileTypes: z.array(z.string()).optional(),
  requiresAttachment: z.boolean().optional(),
  allowResubmission: z.boolean().optional(),
  status: z.enum(["DRAFT", "ASSIGNED", "OPEN", "CLOSED"]).optional(),
});

export const duplicateAssignmentSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
});

export const gradeAssignmentSchema = z.object({
  score: z.number().nonnegative().max(1000).optional(),
  feedback: z.string().max(4000).optional(),
  requestResubmission: z.boolean().optional(),
  published: z.boolean().optional(),
  strengths: z.array(z.string()).max(20).optional(),
  improvements: z.array(z.string()).max(20).optional(),
  returnReason: z.string().max(2000).optional(),
});

export const studentAnswerSchema = z.object({
  questionId: idSchema,
  answer: z.union([
    z.string(),
    z.string().array(),
    z.record(z.string(), z.unknown()),
  ]),
  sectionIndex: z.number().int().nonnegative().optional(),
  updatedAt: z.number().optional(),
});

export const answersBatchSchema = z.object({
  answers: z.array(studentAnswerSchema).max(300),
});

export const integrityEventSchema = z.object({
  type: z
    .string()
    .trim()
    .min(1)
    .max(120),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});