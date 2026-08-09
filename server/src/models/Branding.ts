import mongoose, { Schema, type Document, type Types, type Model } from "mongoose";

export interface IBranding extends Document {
  userId: Types.ObjectId;
  name: string;
  tagline?: string;
  logoUrl?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  social: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new mongoose.Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    tagline: { type: String, trim: true, maxlength: 200, default: "" },
    logoUrl: { type: String, default: null },
    address: { type: String, maxlength: 300, default: null },
    email: { type: String, lowercase: true, default: null },
    phone: { type: String, maxlength: 30, default: null },
    website: { type: String, maxlength: 200, default: null },
    social: {
      facebook: { type: String, maxlength: 200, default: "" },
      twitter: { type: String, maxlength: 200, default: "" },
      instagram: { type: String, maxlength: 200, default: "" },
      linkedin: { type: String, maxlength: 200, default: "" },
    },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Branding: Model<IBranding> = mongoose.model<IBranding>("Branding", schema);