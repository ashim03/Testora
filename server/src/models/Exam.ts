import mongoose, { type Document, type Types, type Model } from "mongoose";
import { QUESTION_CATEGORIES } from "@testora-platform/shared";

export interface IExamSection extends Document {
  examId: Types.ObjectId;
  title: string;
  order: number;
  durationSec?: number | null;
  questionIds: Types.ObjectId[];
  instructions: string;
  audioUrl?: string | null;
  audioAssetId?: Types.ObjectId | null;
  audioDuration?: number | null;
  audioPlayRules?: { maxPlays?: number | null; allowSeek?: boolean } | null;
}

export interface IExam extends Document {
  createdBy: Types.ObjectId;
  title: string;
  type: "PRACTICE" | "SECTIONAL" | "MOCK" | "CUSTOM";
  category: (typeof QUESTION_CATEGORIES)[number];
  part?: string | null;
  description: string;
  durationSec?: number | null;
  sections: Array<{
    _id?: Types.ObjectId;
    title: string;
    order: number;
    durationSec?: number | null;
    questionIds: Types.ObjectId[];
    instructions: string;
    audioUrl?: string | null;
    audioAssetId?: Types.ObjectId | null;
    audioDuration?: number | null;
    audioPlayRules?: { maxPlays?: number | null; allowSeek?: boolean } | null;
  }>;
  questionIds: Types.ObjectId[];
  startAt?: Date | null;
  endAt?: Date | null;
  attemptLimit: number;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  allowNavigation: boolean;
  allowReview: boolean;
  autoSubmit: boolean;
  allowLateSubmission: boolean;
  sectionWiseTiming: boolean;
  negativeMarking: boolean;
  showAnswersImmediately: boolean;
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED" | "COMPLETED";
  passMarks?: number | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const sectionAudioPlayRulesSchema = new mongoose.Schema(
  {
    maxPlays: { type: Number, default: null, min: 1, max: 50 },
    allowSeek: { type: Boolean, default: true },
  },
  { _id: false },
);

const sectionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, maxlength: 120 },
    order: { type: Number, default: 0 },
    durationSec: { type: Number, default: null },
    questionIds: { type: [mongoose.Schema.Types.ObjectId], ref: "Question", default: [] },
    instructions: { type: String, default: "" },
    audioUrl: { type: String, default: null },
    audioAssetId: { type: mongoose.Schema.Types.ObjectId, ref: "MediaAsset", default: null },
    audioDuration: { type: Number, default: null },
    audioPlayRules: { type: sectionAudioPlayRulesSchema, default: null },
  },
  { _id: true },
);

const schema = new mongoose.Schema(
  {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    type: { type: String, enum: ["PRACTICE", "SECTIONAL", "MOCK", "CUSTOM"], default: "PRACTICE" },
    category: { type: String, enum: QUESTION_CATEGORIES, required: true, index: true },
    part: { type: String, default: null, trim: true, maxlength: 20 },
    description: { type: String, default: "" },
    durationSec: { type: Number, default: null },
    sections: { type: [sectionSchema], default: [] },
    questionIds: { type: [mongoose.Schema.Types.ObjectId], ref: "Question", default: [] },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    attemptLimit: { type: Number, default: 1, min: 1, max: 100 },
    randomizeQuestions: { type: Boolean, default: false },
    randomizeOptions: { type: Boolean, default: false },
    allowNavigation: { type: Boolean, default: true },
    allowReview: { type: Boolean, default: true },
    autoSubmit: { type: Boolean, default: true },
    allowLateSubmission: { type: Boolean, default: true },
    sectionWiseTiming: { type: Boolean, default: false },
    negativeMarking: { type: Boolean, default: false },
    showAnswersImmediately: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED", "COMPLETED"],
      default: "DRAFT",
      index: true,
    },
    passMarks: { type: Number, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Exam: Model<IExam> = mongoose.model<IExam>("Exam", schema);
export const ExamSection: Model<IExamSection> = mongoose.model<IExamSection>(
  "ExamSection",
  sectionSchema,
);

export interface IExamAssignment extends Document {
  examId: Types.ObjectId;
  studentId: Types.ObjectId;
  teacherId?: Types.ObjectId | null;
  batchId?: Types.ObjectId | null;
  assignedBy: Types.ObjectId;
  assignedAt: Date;
  dueAt?: Date | null;
  status: "ASSIGNED" | "STARTED" | "COMPLETED" | "EXPIRED";
  attemptCount: number;
}

const examAssignmentSchema = new mongoose.Schema(
  {
    examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", default: null },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedAt: { type: Date, default: Date.now },
    dueAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["ASSIGNED", "STARTED", "COMPLETED", "EXPIRED"],
      default: "ASSIGNED",
    },
    attemptCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

examAssignmentSchema.index({ studentId: 1, examId: 1 });

export const ExamAssignment: Model<IExamAssignment> = mongoose.model<IExamAssignment>(
  "ExamAssignment",
  examAssignmentSchema,
);