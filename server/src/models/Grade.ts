import mongoose, { type Document, type Types, type Model } from "mongoose";

export type GradeStatus = "DRAFT" | "PUBLISHED";

export interface IGrade extends Document {
  attemptId?: Types.ObjectId | null;
  submissionId?: Types.ObjectId | null;
  questionId?: Types.ObjectId | null;
  graderId: Types.ObjectId;
  studentId: Types.ObjectId;
  teacherId: Types.ObjectId;
  score: number;
  rubricId?: Types.ObjectId | null;
  criteria: Array<{
    key: string;
    label: string;
    score: number;
    max: number;
    comment?: string;
  }>;
  feedback?: string | null;
  strengths: string[];
  improvements: string[];
  status: GradeStatus;
  createdAt: Date;
  updatedAt: Date;
}

const gradeSchema = new mongoose.Schema(
  {
    attemptId: { type: mongoose.Schema.Types.ObjectId, ref: "ExamAttempt", default: null, index: true },
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AssignmentSubmission",
      default: null,
      index: true,
    },
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: "Question", default: null },
    graderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    score: { type: Number, required: true, min: 0, max: 1000 },
    rubricId: { type: mongoose.Schema.Types.ObjectId, ref: "Rubric", default: null },
    criteria: {
      type: [
        {
          key: String,
          label: String,
          score: Number,
          max: Number,
          comment: { type: String, default: "" },
        },
      ],
      default: [],
    },
    feedback: { type: String, default: null },
    strengths: { type: [String], default: [] },
    improvements: { type: [String], default: [] },
    status: { type: String, enum: ["DRAFT", "PUBLISHED"], default: "DRAFT" },
  },
  { timestamps: true },
);

export const Grade: Model<IGrade> = mongoose.model<IGrade>("Grade", gradeSchema);

export interface IFeedback extends Document {
  studentId: Types.ObjectId;
  teacherId: Types.ObjectId;
  attemptId?: Types.ObjectId | null;
  submissionId?: Types.ObjectId | null;
  gradeId?: Types.ObjectId | null;
  content: string;
  audioUrl?: string | null;
  strengths: string[];
  improvements: string[];
  status: GradeStatus;
  createdAt: Date;
  updatedAt: Date;
}

const feedbackSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    attemptId: { type: mongoose.Schema.Types.ObjectId, ref: "ExamAttempt", default: null },
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AssignmentSubmission",
      default: null,
    },
    gradeId: { type: mongoose.Schema.Types.ObjectId, ref: "Grade", default: null },
    content: { type: String, required: true },
    audioUrl: { type: String, default: null },
    strengths: { type: [String], default: [] },
    improvements: { type: [String], default: [] },
    status: { type: String, enum: ["DRAFT", "PUBLISHED"], default: "DRAFT" },
  },
  { timestamps: true },
);

export const Feedback: Model<IFeedback> = mongoose.model<IFeedback>("Feedback", feedbackSchema);