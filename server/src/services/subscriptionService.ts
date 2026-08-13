import { Types } from "mongoose";
import { Subscription } from "../models";
import { SUBSCRIPTION_PLANS, type SubscriptionPlanKey } from "@testora-platform/shared";
import { ApiError } from "../utils/helpers";

const DAY_MS = 24 * 60 * 60 * 1000;

function planDays(plan: string): number {
  const found = SUBSCRIPTION_PLANS.find((p) => p.key === plan);
  if (!found) throw new ApiError(400, "Invalid subscription plan");
  return found.days;
}

export async function getSubscription(userId: string) {
  let sub = await Subscription.findOne({ userId: new Types.ObjectId(userId) }).lean();

  if (sub && sub.status === "ACTIVE" && sub.endDate && new Date(sub.endDate).getTime() <= Date.now()) {
    await Subscription.updateOne({ _id: sub._id }, { $set: { status: "EXPIRED" } });
    sub = await Subscription.findOne({ userId: new Types.ObjectId(userId) }).lean();
  }

  if (!sub) {
    return {
      active: false,
      subscription: null,
      plan: null,
      daysLeft: 0,
      daysTotal: 0,
    };
  }

  const daysLeft = sub.endDate ? Math.max(0, Math.ceil((new Date(sub.endDate).getTime() - Date.now()) / DAY_MS)) : 0;
  return {
    active: sub.status === "ACTIVE",
    subscription: sub,
    plan: sub.plan,
    daysLeft,
    daysTotal: sub.startDate && sub.endDate ? Math.max(1, Math.round((new Date(sub.endDate).getTime() - new Date(sub.startDate).getTime()) / DAY_MS)) : 0,
  };
}

export async function subscribe(userId: string, plan: SubscriptionPlanKey, startDate?: string) {
  const days = planDays(plan);
  const start = startDate ? new Date(startDate) : new Date();
  if (Number.isNaN(start.getTime())) throw new ApiError(400, "Invalid start date");
  const end = new Date(start.getTime() + days * DAY_MS);

  const existing = await Subscription.findOne({ userId: new Types.ObjectId(userId) });
  if (existing) {
    existing.plan = plan;
    existing.status = "ACTIVE";
    existing.startDate = start;
    existing.endDate = end;
    existing.cancelledAt = null;
    await existing.save();
  } else {
    await Subscription.create({ userId: new Types.ObjectId(userId), plan, status: "ACTIVE", startDate: start, endDate: end });
  }

  return getSubscription(userId);
}

export async function cancelSubscription(userId: string) {
  const sub = await Subscription.findOne({ userId: new Types.ObjectId(userId) });
  if (!sub || sub.status === "CANCELLED") return getSubscription(userId);
  sub.status = "CANCELLED";
  sub.cancelledAt = new Date();
  await sub.save();
  return getSubscription(userId);
}