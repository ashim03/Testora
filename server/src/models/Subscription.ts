import mongoose, { type Document, type Types, type Model } from "mongoose";
import { SUBSCRIPTION_PLAN_KEYS, SUBSCRIPTION_STATUSES, type SubscriptionPlanKey, type SubscriptionStatus } from "@testora-platform/shared";

export interface ISubscription extends Document {
  userId: Types.ObjectId;
  plan: SubscriptionPlanKey;
  status: SubscriptionStatus;
  startDate: Date;
  endDate: Date | null;
  cancelledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    plan: { type: String, enum: SUBSCRIPTION_PLAN_KEYS, required: true },
    status: { type: String, enum: SUBSCRIPTION_STATUSES, default: "ACTIVE", index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ userId: 1, status: 1 });

export const Subscription: Model<ISubscription> = mongoose.model<ISubscription>(
  "Subscription",
  schema,
);