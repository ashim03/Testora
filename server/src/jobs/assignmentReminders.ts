import { processAssignmentSchedules } from "../services/assignmentSchedulingService";

let running = false;

export async function processAssignmentReminders(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await processAssignmentSchedules();
  } catch (error) {
    console.error("[assignment-reminders] failed", error);
  } finally {
    running = false;
  }
}

export function startAssignmentReminderInterval(): NodeJS.Timeout {
  void processAssignmentReminders();
  return setInterval(() => void processAssignmentReminders(), 5 * 60 * 1000);
}
