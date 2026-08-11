import { z } from "zod";
import { QUESTION_TYPES, QUESTION_CATEGORIES } from "../constants";

const optionSchema = z.object({
  key: z.string().min(1),
  text: z.string().min(1).max(500),
});

export const questionOptionSchema = z
  .array(optionSchema)
  .min(2, "At least two options are required")
  .max(12);

export const correctAnswerSchema = z
  .array(
    z.union([
      z.string().trim().min(1),
      z.object({ key: z.string().min(1), text: z.string() }).passthrough(),
    ]),
  )
  .max(12);

export const acceptedAnswersSchema = z
  .array(z.string().trim().min(1).max(200))
  .max(20);

const audioPlayRulesSchema = z
  .object({
    maxPlays: z.number().int().positive().max(50).nullable().optional(),
    allowSeek: z.boolean().optional(),
  })
  .optional()
  .nullable();

export const createQuestionSchema = z.object({
  category: z.enum(QUESTION_CATEGORIES as unknown as [string, ...string[]]),
  type: z.enum(QUESTION_TYPES as unknown as [string, ...string[]]),
  title: z.string().trim().min(3).max(300),
  instructions: z.string().max(2000).optional().default(""),
  passage: z.string().max(30000).optional().default(""),
  passageId: z.string().optional().nullable(),
  audioUrl: z
    .string()
    .trim()
    .min(1)
    .max(1000)
    .optional()
    .nullable()
    .refine((v) => !v || /^(https?:\/\/|\/|data:)/.test(v), { message: "audioUrl must be an absolute URL, relative path or data URI" }),
  audioAssetId: z.string().optional().nullable(),
  audioDuration: z.number().int().positive().max(7200).optional().nullable(),
  audioPlayRules: audioPlayRulesSchema,
  imageUrl: z.string().url().optional().nullable(),
  videoUrl: z.string().url().optional().nullable(),
  options: questionOptionSchema.optional(),
  correctAnswers: correctAnswerSchema.optional().default([]),
  acceptedAnswers: acceptedAnswersSchema.optional().default([]),
  maxWordLimit: z.number().int().positive().max(2000).optional(),
  minWordLimit: z.number().int().nonnegative().max(2000).optional(),
  marks: z.number().positive().max(100).default(1),
  negativeMarks: z.number().nonnegative().max(10).default(0),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
  explanation: z.string().max(3000).optional().default(""),
  tags: z.array(z.string().max(30)).max(20).optional().default([]),
  rubric: z
    .array(
      z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        max: z.number().positive().max(10),
        weight: z.number().nonnegative().max(100),
      }),
    )
    .optional()
    .default([]),
  correctAnswerKeys: z.array(z.string()).max(12).optional(),
});

export const updateQuestionSchema = createQuestionSchema.partial();

export const createPassageSchema = z.object({
  title: z.string().trim().min(3).max(300),
  content: z.string().min(10).max(60000),
  category: z.enum(QUESTION_CATEGORIES as unknown as [string, ...string[]]),
  tags: z.array(z.string().max(30)).max(20).optional().default([]),
});

export const createRubricSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(["IELTS_WRITING", "IELTS_SPEAKING", "PTE"]),
  criteria: z
    .array(
      z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        max: z.number().positive().max(10),
        weight: z.number().nonnegative().max(100),
      }),
    )
    .min(1)
    .max(12),
});

export const scoreConversionSchema = z.object({
  category: z.enum(QUESTION_CATEGORIES as unknown as [string, ...string[]]),
  rows: z
    .array(
      z.object({
        minRaw: z.number().nonnegative(),
        maxRaw: z.number().nonnegative(),
        practiceBand: z.number().nonnegative().max(9),
      }),
    )
    .min(1),
});