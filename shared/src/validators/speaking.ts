import { z } from "zod";
import { SPEAKING_TASK_TYPES } from "../constants";

export const createSpeakingAttemptSchema = z.object({
  taskType: z.enum(SPEAKING_TASK_TYPES as unknown as [string, ...string[]]),
  title: z.string().trim().min(1).max(200).default("Speaking practice"),
  prompt: z.string().trim().min(1).max(2000).optional().default(""),
  durationSec: z.coerce.number().int().min(0).max(3600).optional().default(0),
  keepAudio: z.coerce.boolean().optional().default(false),
});

export const speakingPaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
