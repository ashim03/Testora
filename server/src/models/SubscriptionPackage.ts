import mongoose, { type Document, type Model } from "mongoose";
import { CURRENCY } from "@testora-platform/shared";

export interface ISubscriptionPackage extends Document {
  name: string;
  studentLimit: number;
  teacherLimit: number;
  durationDays: number;
  price: number;
  currency: string;
  description: string;
  features: string[];
  active: boolean;
  createdBy?: mongoose.Types.ObjectId | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120, index: true },
    studentLimit: { type: Number, required: true, min: 1 },
    teacherLimit: { type: Number, required: true, min: 1 },
    durationDays: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: CURRENCY, maxlength: 8 },
    description: { type: String, maxlength: 500, default: "" },
    features: { type: [String], default: [] },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ createdAt: -1 });

export const SubscriptionPackage: Model<ISubscriptionPackage> = mongoose.model<ISubscriptionPackage>(
  "SubscriptionPackage",
  schema,
);