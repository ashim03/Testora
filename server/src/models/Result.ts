import mongoose, { type Document, type Types, type Model } from "mongoose";

export interface IResult extends Document {
  attemptId: Types.ObjectId;
  examId: Types.ObjectId;
  studentId: Types.ObjectId;
  teacherId?: Types.ObjectId | null;
  examTitle: string;
  category: string;
  objectiveScore?: number | null;
  subjectiveScore?: number | null;
  finalScore?: number | null;
  rawScore?: number | null;
  maxScore?: number | null;
  percentage?: number | null;
  practiceBand?: number | null;
  estimatedPteScore?: number | null;
  skillScores?: Record<string, number>;
  published: boolean;
  publishedBy?: Types.ObjectId | null;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new mongoose.Schema(
  {
    attemptId: { type: mongoose.Schema.Types.ObjectId, ref: "ExamAttempt", required: true },
    examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    examTitle: { type: String, default: "" },
    category: { type: String, default: "" },
    objectiveScore: { type: Number, default: null },
    subjectiveScore: { type: Number, default: null },
    finalScore: { type: Number, default: null },
    rawScore: { type: Number, default: null },
    maxScore: { type: Number, default: null },
    percentage: { type: Number, default: null },
    practiceBand: { type: Number, default: null },
    estimatedPteScore: { type: Number, default: null },
    skillScores: { type: mongoose.Schema.Types.Mixed, default: {} },
    published: { type: Boolean, default: false },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ studentId: 1, published: 1 });
schema.index({ attemptId: 1 }, { unique: true });

export const Result: Model<IResult> = mongoose.model<IResult>("Result", schema);