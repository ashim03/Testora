import { ZodType } from "zod";

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: Array<{ field?: string; message: string }> };

export function validateWithSchema<T>(schema: ZodType<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors = result.error.issues.map((issue) => ({
    field: issue.path.join(".") || undefined,
    message: issue.message,
  }));
  return { success: false, errors };
}