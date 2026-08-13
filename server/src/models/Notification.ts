import mongoose, { type Document, type Types, type Model } from "mongoose";
import { NOTIFICATION_TYPES } from "@testora-platform/shared";

export interface INotification extends Document {
  recipientId: Types.ObjectId;
  type: (typeof NOTIFICATION_TYPES)[number];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read: boolean;
  readAt?: Date | null;
  createdAt: Date;
}

const schema = new mongoose.Schema(
  {
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 1000 },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ recipientId: 1, read: 1, createdAt: -1 });

export const Notification: Model<INotification> = mongoose.model<INotification>(
  "Notification",
  schema,
);

export interface IActivityLog extends Document {
  userId: Types.ObjectId;
  action: string;
  entityType?: string;
  entityId?: Types.ObjectId | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  createdAt: Date;
}

const activitySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, required: true, maxlength: 120 },
    entityType: { type: String, maxlength: 60, default: "" },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: null },
  },
  { timestamps: true },
);

activitySchema.index({ userId: 1, createdAt: -1 });

export const ActivityLog: Model<IActivityLog> = mongoose.model<IActivityLog>(
  "ActivityLog",
  activitySchema,
);

export interface IAuditLog extends Document {
  actorId?: Types.ObjectId | null;
  actorRole?: string | null;
  action: string;
  entityType?: string;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip?: string | null;
  createdAt: Date;
}

const auditSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    actorRole: { type: String, default: null },
    action: { type: String, required: true, maxlength: 120, index: true },
    entityType: { type: String, maxlength: 60, default: "" },
    entityId: { type: String, default: null },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    ip: { type: String, default: null },
  },
  { timestamps: true },
);

auditSchema.index({ createdAt: -1 });

export const AuditLog: Model<IAuditLog> = mongoose.model<IAuditLog>("AuditLog", auditSchema);