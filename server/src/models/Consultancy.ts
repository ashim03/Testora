import mongoose, { type Types, type Document, type Model } from "mongoose";
import { CONSULTANCY_SUBSCRIPTION_STATUSES } from "@testora-platform/shared";

export interface IConsultancySubscriptionLedger {
  packageId?: Types.ObjectId | null;
  packageName: string;
  price: number;
  currency: string;
  durationDays: number;
  studentLimit: number;
  teacherLimit: number;
  startDate: Date;
  endDate: Date;
  assignedBy?: Types.ObjectId | null;
  assignedAt: Date;
  note?: string | null;
}

export interface IConsultancy extends Document {
  name: string;
  code: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  packageId?: Types.ObjectId | null;
  subscriptionStatus: (typeof CONSULTANCY_SUBSCRIPTION_STATUSES)[number];
  subscriptionStartDate?: Date | null;
  subscriptionEndDate?: Date | null;
  studentLimit?: number | null;
  teacherLimit?: number | null;
  subscriptionLedger: IConsultancySubscriptionLedger[];
  createdBy?: Types.ObjectId | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120, index: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 40 },
    contactName: { type: String, maxlength: 120, default: null },
    contactEmail: { type: String, lowercase: true, trim: true, maxlength: 191, default: null },
    contactPhone: { type: String, maxlength: 30, default: null },
    address: { type: String, maxlength: 300, default: null },
    status: { type: String, enum: ["ACTIVE", "INACTIVE", "SUSPENDED"], default: "ACTIVE", index: true },
    packageId: { type: mongoose.Schema.Types.ObjectId, ref: "SubscriptionPackage", default: null },
    subscriptionStatus: {
      type: String,
      enum: CONSULTANCY_SUBSCRIPTION_STATUSES,
      default: "TRIAL",
      index: true,
    },
    subscriptionStartDate: { type: Date, default: null },
    subscriptionEndDate: { type: Date, default: null },
    studentLimit: { type: Number, default: null },
    teacherLimit: { type: Number, default: null },
    subscriptionLedger: {
      type: [
        {
          packageId: { type: mongoose.Schema.Types.ObjectId, ref: "SubscriptionPackage", default: null },
          packageName: { type: String, required: true },
          price: { type: Number, required: true },
          currency: { type: String, default: "NPR" },
          durationDays: { type: Number, required: true },
          studentLimit: { type: Number, required: true },
          teacherLimit: { type: Number, required: true },
          startDate: { type: Date, required: true },
          endDate: { type: Date, required: true },
          assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
          assignedAt: { type: Date, default: () => new Date() },
          note: { type: String, maxlength: 300, default: null },
        },
      ],
      default: [],
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ createdAt: -1 });

export const Consultancy: Model<IConsultancy> = mongoose.model<IConsultancy>("Consultancy", schema);