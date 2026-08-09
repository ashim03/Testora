import mongoose, { type Document, type Model } from "mongoose";

export interface ICourse extends Document {
  name: string;
  code: string;
  type: "IELTS" | "PTE";
  description: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    code: { type: String, required: true, trim: true, maxlength: 40 },
    type: { type: String, enum: ["IELTS", "PTE"], required: true },
    description: { type: String, maxlength: 1000, default: "" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Course: Model<ICourse> = mongoose.model<ICourse>("Course", schema);

export interface ICategory extends Document {
  name: string;
  code?: string;
  type?: "IELTS" | "PTE";
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    code: { type: String, maxlength: 40, default: "" },
    type: { type: String, enum: ["IELTS", "PTE"], default: "IELTS" },
    description: { type: String, maxlength: 500, default: "" },
  },
  { timestamps: true },
);

export const Category: Model<ICategory> = mongoose.model<ICategory>("Category", categorySchema);