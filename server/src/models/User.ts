import mongoose, { type Types, type Document, type Model } from "mongoose";
import { ROLES } from "@testora-platform/shared";

export type UserRole = "SUPER_ADMIN" | "TEACHER" | "STUDENT";
export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string | null;
  dateOfBirth?: Date | null;
  gender?: string | null;
  address?: string | null;
  country?: string | null;
  timezone?: string | null;
  lastLoginAt?: Date | null;
  createdBy?: Types.ObjectId | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 60 },
    lastName: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, maxlength: 30, default: null },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), required: true, index: true },
    status: { type: String, enum: ["ACTIVE", "INACTIVE", "SUSPENDED"], default: "ACTIVE", index: true },
    avatarUrl: { type: String, default: null },
    dateOfBirth: { type: Date, default: null },
    gender: { type: String, enum: ["MALE", "FEMALE", "OTHER", ""], default: null },
    address: { type: String, maxlength: 300, default: null },
    country: { type: String, maxlength: 80, default: null },
    timezone: { type: String, maxlength: 80, default: null },
    lastLoginAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ createdAt: -1 });

export const User: Model<IUser> = mongoose.model<IUser>("User", schema);