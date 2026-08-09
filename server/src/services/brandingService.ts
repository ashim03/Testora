import { Branding } from "../models";
import { ApiError } from "../utils/helpers";
import { audit, logActivity } from "./notificationService";

export interface BrandingData {
  name?: string;
  tagline?: string;
  logoUrl?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  social?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
  };
}

export async function setBranding(
  userId: string,
  data: BrandingData,
  actor: { id: string; role: string },
  ip?: string | null,
): Promise<unknown> {
  let branding = await Branding.findOne({ userId });
  if (!branding) {
    branding = await Branding.create({
      userId,
      name: data.name || "Testora Consultancy",
      tagline: data.tagline || "",
      logoUrl: data.logoUrl || null,
      address: data.address || null,
      email: data.email || null,
      phone: data.phone || null,
      website: data.website || null,
      social: { facebook: "", twitter: "", instagram: "", linkedin: "" },
    });
  }
  if (data.name) branding.name = data.name;
  if (data.tagline !== undefined) branding.tagline = data.tagline;
  if (data.logoUrl !== undefined) branding.logoUrl = data.logoUrl;
  if (data.address !== undefined) branding.address = data.address;
  if (data.email !== undefined) branding.email = data.email;
  if (data.phone !== undefined) branding.phone = data.phone;
  if (data.website !== undefined) branding.website = data.website;
  if (data.social) branding.social = { ...branding.social, ...data.social };
  branding.isActive = true;
  await branding.save();

  // A single consultancy's brand is displayed app-wide; deactivate others.
  if (branding.isActive) {
    await Branding.updateMany({ _id: { $ne: branding._id } }, { $set: { isActive: false } });
  }

  await audit("BRANDING_UPDATE", {
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "Branding",
    entityId: String(branding._id),
  });
  await logActivity(actor.id, "BRANDING_UPDATE", "Branding", branding._id, { name: branding.name }, ip);

  return sanitize(branding);
}

export async function getActiveBranding(): Promise<unknown> {
  const branding = await Branding.findOne({ isActive: true }).sort({ updatedAt: -1 }).lean();
  return branding ? sanitize(branding) : null;
}

export async function getBrandingForUser(userId: string): Promise<unknown> {
  const branding = await Branding.findOne({ userId }).lean();
  return branding ? sanitize(branding) : null;
}

export async function clearLogo(userId: string): Promise<unknown> {
  const branding = await Branding.findOne({ userId });
  if (!branding) throw new ApiError(404, "Branding not found");
  branding.logoUrl = null;
  await branding.save();
  return sanitize(branding);
}

function sanitize(b: {
  _id: unknown;
  userId: unknown;
  name: string;
  tagline?: string;
  logoUrl?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  social?: Record<string, string>;
  isActive: boolean;
}): Record<string, unknown> {
  return {
    id: String(b._id),
    userId: String(b.userId),
    name: b.name,
    tagline: b.tagline || "",
    logoUrl: b.logoUrl || null,
    address: b.address || null,
    email: b.email || null,
    phone: b.phone || null,
    website: b.website || null,
    social: b.social || { facebook: "", twitter: "", instagram: "", linkedin: "" },
    isActive: b.isActive,
  };
}

export const sanitizeBranding = sanitize;