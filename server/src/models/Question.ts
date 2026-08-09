import mongoose, { type Document, type Types, type Model } from "mongoose";
import { QUESTION_CATEGORIES, QUESTION_TYPES } from "@ielts-pte-platform/shared";

export type QuestionCategoryType = (typeof QUESTION_CATEGORIES)[number];
export type QuestionType = (typeof QUESTION_TYPES)[number];

interface Option {
  key: string;
  text: string;
}

interface RubricCriterion {
  key: string;
  label: string;
  max: number;
  weight: number;
}

export interface IQuestion extends Document {
  createdBy: Types.ObjectId;
  category: QuestionCategoryType;
  type: QuestionType;
  title: string;
  instructions: string;
  passage: string;
  passageId?: Types.ObjectId | null;
  audioUrl?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  options?: Option[];
  correctAnswers: string[];
  acceptedAnswers?: string[];
  maxWordLimit?: number;
  minWordLimit?: number;
  marks: number;
  negativeMarks: number;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  explanation?: string;
  tags?: string[];
  rubric?: RubricCriterion[];
  audioDuration?: number;
  deletedAt?: Date | null;
  isPublic?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const optionSchema = new mongoose.Schema(
  { key: { type: String, required: true }, text: { type: String, required: true } },
  { _id: false },
);

const rubricSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    max: { type: Number, required: true },
    weight: { type: Number, required: true },
  },
  { _id: false },
);

const schema = new mongoose.Schema(
  {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: { type: String, enum: QUESTION_CATEGORIES, required: true, index: true },
    type: { type: String, enum: QUESTION_TYPES, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    instructions: { type: String, maxlength: 2000, default: "" },
    passage: { type: String, default: "" },
    passageId: { type: mongoose.Schema.Types.ObjectId, ref: "Passage", default: null },
    audioUrl: { type: String, default: null },
    imageUrl: { type: String, default: null },
    videoUrl: { type: String, default: null },
    options: { type: [optionSchema], default: [] },
    correctAnswers: { type: [String], default: [] },
    acceptedAnswers: { type: [String], default: [] },
    maxWordLimit: { type: Number, default: null },
    minWordLimit: { type: Number, default: null },
    marks: { type: Number, default: 1, min: 0, max: 100 },
    negativeMarks: { type: Number, default: 0, min: 0, max: 10 },
    difficulty: { type: String, enum: ["EASY", "MEDIUM", "HARD"], default: "MEDIUM" },
    explanation: { type: String, default: "" },
    tags: { type: [String], default: [] },
    rubric: { type: [rubricSchema], default: [] },
    audioDuration: { type: Number, default: null },
    deletedAt: { type: Date, default: null },
    isPublic: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Question: Model<IQuestion> = mongoose.model<IQuestion>("Question", schema);