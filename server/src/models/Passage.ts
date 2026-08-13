import mongoose, { type Document, type Types, type Model } from "mongoose";
import { QUESTION_CATEGORIES } from "@testora-platform/shared";

export interface IPassage extends Document {
  title: string;
  content: string;
  category: (typeof QUESTION_CATEGORIES)[number];
  createdBy: Types.ObjectId;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const schema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 300 },
    content: { type: String, required: true },
    category: { type: String, enum: QUESTION_CATEGORIES, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tags: { type: [String], default: [] },
  },
  { timestamps: true },
);

export const Passage: Model<IPassage> = mongoose.model<IPassage>("Passage", schema);

export interface IMediaAsset extends Document {
  kind: string;
  url: string;
  publicId?: string;
  mimeType: string;
  size: number;
  uploadedBy: Types.ObjectId;
  ownerId?: Types.ObjectId | null;
  provider: "cloudinary" | "local";
  createdAt: Date;
}

const mediaSchema = new mongoose.Schema(
  {
    kind: { type: String, required: true, index: true },
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
    mimeType: { type: String, required: true },
    size: { type: Number, default: 0 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    provider: { type: String, enum: ["cloudinary", "local"], default: "cloudinary" },
  },
  { timestamps: true },
);

export const MediaAsset: Model<IMediaAsset> = mongoose.model<IMediaAsset>("MediaAsset", mediaSchema);