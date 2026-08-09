import { ExamAttempt, ExamAssignment } from "../models";
import { afterSubmit } from "../services/gradingService";

/**
 * Background reconciler for automatically submitting expired attempts.
 * In production this would run on an interval (e.g. cron). It is exported
 * for tests and can be wired to a scheduler such as node-cron or a
 * serverless timer.
 */
export async function autoSubmitExpiredAttempts(): Promise<number> {
  const now = new Date();
  const expired = await ExamAttempt.find({
    status: "IN_PROGRESS",
    expiresAt: { $lte: now },
  }).limit(500);
  let count = 0;
  for (const attempt of expired) {
    attempt.status = "SUBMITTED";
    attempt.submittedAt = now;
    await attempt.save();
    await ExamAssignment.updateOne(
      { examId: attempt.examId, studentId: attempt.studentId },
      { $set: { status: "COMPLETED" } },
    );
    await afterSubmit(String(attempt._id));
    count += 1;
  }
  return count;
}

export function startAutoSubmitInterval(intervalMs = 60 * 1000): NodeJS.Timeout | null {
  if (process.env.NODE_ENV === "test") return null;
  autoSubmitExpiredAttempts().catch((e) => console.error("[jobs] auto submit failed", e));
  const handle = setInterval(() => {
    autoSubmitExpiredAttempts().catch((e) => console.error("[jobs] auto submit failed", e));
  }, intervalMs);
  handle.unref();
  return handle;
}