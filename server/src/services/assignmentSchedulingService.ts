import { Assignment } from "../models";
import { ApiError } from "../utils/helpers";
import { audit, notify } from "./notificationService";

const DEFAULT_REMINDERS = [24, 1];
const TRIGGER_TOLERANCE_MS = 10 * 60 * 1000;

export async function scheduleAssignment(
  id: string,
  data: { publishAt?: string | null; dueAt?: string | null; reminderHoursBefore?: number[] },
  actor: { id: string; role: string },
): Promise<unknown> {
  const assignment = await Assignment.findOne({ _id: id, createdBy: actor.id, deletedAt: null });
  if (!assignment) throw new ApiError(404, "Assignment not found");

  const publishAt = data.publishAt ? new Date(data.publishAt) : null;
  const dueAt = data.dueAt ? new Date(data.dueAt) : assignment.dueAt;
  if (publishAt && Number.isNaN(publishAt.getTime())) throw new ApiError(400, "Invalid publish time");
  if (dueAt && Number.isNaN(new Date(dueAt).getTime())) throw new ApiError(400, "Invalid due time");
  if (publishAt && dueAt && publishAt.getTime() >= new Date(dueAt).getTime()) throw new ApiError(400, "Publish time must be before the due time");

  const reminders = [...new Set((data.reminderHoursBefore ?? DEFAULT_REMINDERS).map(Number))]
    .filter((hours) => Number.isFinite(hours) && hours >= 0 && hours <= 168)
    .sort((a, b) => b - a);

  assignment.publishAt = publishAt;
  assignment.dueAt = dueAt;
  assignment.reminderHoursBefore = reminders;
  assignment.reminderSentAt = [];
  assignment.status = publishAt && publishAt.getTime() > Date.now() ? "SCHEDULED" : "DRAFT";
  assignment.published = false;
  await assignment.save();

  await audit("SCHEDULE_ASSIGNMENT", {
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "Assignment",
    entityId: String(assignment._id),
    after: { publishAt: assignment.publishAt, dueAt: assignment.dueAt, reminderHoursBefore: reminders, status: assignment.status },
  });
  return assignment;
}

function reminderAlreadySent(sentAt: Date[], expectedAt: number): boolean {
  return sentAt.some((value) => Math.abs(new Date(value).getTime() - expectedAt) <= TRIGGER_TOLERANCE_MS);
}

export async function processAssignmentSchedules(now = new Date()): Promise<void> {
  const dueForPublishing = await Assignment.find({
    deletedAt: null,
    status: "SCHEDULED",
    published: false,
    publishAt: { $ne: null, $lte: now },
  });

  for (const assignment of dueForPublishing) {
    assignment.published = true;
    assignment.status = "OPEN";
    await assignment.save();
    for (const studentId of assignment.studentIds) {
      await notify(studentId, "ASSIGNMENT_CREATED", "Assignment is now available", `"${assignment.title}" is now open for submission.`, {
        assignmentId: String(assignment._id), dueAt: assignment.dueAt,
      });
    }
    await audit("AUTO_PUBLISH_ASSIGNMENT", { actorRole: "SYSTEM", entityType: "Assignment", entityId: String(assignment._id), after: { status: "OPEN", published: true } });
  }

  const candidates = await Assignment.find({
    deletedAt: null,
    published: true,
    status: "OPEN",
    dueAt: { $ne: null, $gt: now },
    reminderHoursBefore: { $exists: true, $ne: [] },
  });

  for (const assignment of candidates) {
    const dueAt = new Date(assignment.dueAt as Date).getTime();
    for (const hours of assignment.reminderHoursBefore || []) {
      const expectedAt = dueAt - Number(hours) * 60 * 60 * 1000;
      if (now.getTime() < expectedAt || now.getTime() - expectedAt > TRIGGER_TOLERANCE_MS) continue;
      if (reminderAlreadySent(assignment.reminderSentAt || [], expectedAt)) continue;

      for (const studentId of assignment.studentIds) {
        await notify(studentId, "ASSIGNMENT_DUE_REMINDER", "Assignment deadline reminder", `"${assignment.title}" is due in ${hours} hour${hours === 1 ? "" : "s"}.`, {
          assignmentId: String(assignment._id), dueAt: assignment.dueAt, hoursBefore: hours,
        });
      }
      assignment.reminderSentAt.push(new Date(expectedAt));
      await assignment.save();
    }
  }
}
