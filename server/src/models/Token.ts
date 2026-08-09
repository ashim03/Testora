import mongoose, { type Document, type Types, type Model } from "mongoose";

export interface IRefreshToken extends Document {
  userId: Types.ObjectId;
  token: string;
  expiresAt: Date;
  revoked?: boolean;
  replacedByToken?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false },
    replacedBy: { type: String, default: null },
  },
  { timestamps: true },
);

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken: Model<IRefreshToken> = mongoose.model<IRefreshToken>(
  "RefreshToken",
  schema,
);

export interface IPasswordResetToken extends Document {
  userId: Types.ObjectId;
  token: string;
  expiresAt: Date;
used: boolean;
  createdAt: Date;
}

const pResetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
  },
  { timestamps: true },
);

pResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetToken: Model<IPasswordResetToken> = mongoose.model<IPasswordResetToken>(
  "PasswordResetToken",
  pResetSchema,
);

export interface ISystemSetting extends Document {
  key: string;
  value: unknown;
  description?: string;
  updatedBy?: Types.ObjectId | null;
  updatedAt: Date;
}

const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
    description: { type: String, default: "" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export const SystemSetting: Model<ISystemSetting> = mongoose.model<ISystemSetting>(
  "SystemSetting",
  settingSchema,
);