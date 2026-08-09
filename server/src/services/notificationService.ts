import { Notification, ActivityLog, AuditLog } from "../models";
import type { Types } from "mongoose";

export async function notify(
  recipientId: string | Types.ObjectId,
  type: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  try {
    await Notification.create({ recipientId, type, title, body, data });
  } catch (error) {
    console.error("[notification] failed", error);
  }
}

export async function logActivity(
  userId: string | Types.ObjectId,
  action: string,
  entityType?: string,
  entityId?: string | Types.ObjectId | null,
  metadata?: Record<string, unknown>,
  ip?: string | null,
): Promise<void> {
  try {
    await ActivityLog.create({
      userId,
      action,
      entityType,
      entityId: entityId ?? null,
      metadata: metadata ?? {},
      ip: ip ?? null,
    });
  } catch (error) {
    console.error("[activity] failed", error);
  }
}

export async function audit(
  action: string,
  options: {
    actorId?: string | Types.ObjectId | null;
    actorRole?: string | null;
    entityType?: string;
    entityId?: string | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    ip?: string | null;
  },
): Promise<void> {
  try {
    await AuditLog.create({
      actorId: options.actorId ?? null,
      actorRole: options.actorRole ?? null,
      action,
      entityType: options.entityType ?? "",
      entityId: options.entityId ?? null,
      before: options.before ?? null,
      after: options.after ?? null,
      ip: options.ip ?? null,
    });
  } catch (error) {
    console.error("[audit] failed", error);
  }
}