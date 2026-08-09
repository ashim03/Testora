import { z } from "zod";
import { SUBSCRIPTION_PLAN_KEYS } from "../constants";

export const subscriptionPlanEnum = SUBSCRIPTION_PLAN_KEYS as unknown as [string, ...string[]];

export const subscribeSchema = z.object({
  plan: z.enum(subscriptionPlanEnum),
  startDate: z.string().datetime({ offset: true }).optional(),
});