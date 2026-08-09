import mongoose, { type Document, type Types, type Model } from "mongoose";

export type AttemptStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "GRADED"
  | "PUBLISHED";

export interface IntegrityEvent {
  type: string;
  occurredAt: Date;
  metadata?: Record<string, unknown>;
}

export interface IExamAttempt extends Document {
  examId: Types.ObjectId;
  studentId: Types.ObjectId;
  teacherId?: Types.ObjectId | null;
  attemptNumber: number;
  startedAt: Date;
  expiresAt: Date;
  submittedAt?: Date | null;
  status: AttemptStatus;
  objectiveScore?: number | null;
  subjectiveScore?: number | null;
  finalScore?: number | null;
  practiceBand?: number | null;
  estimatedPteScore?: number | null;
  rawScore?: number | null;
  maxScore?: number | null;
  integrityEvents: IntegrityEvent[];
  objectiveEvaluator?: boolean;
  receipt?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const integritySchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    occurredAt: { type: Date, default: Date.now },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const schema = new mongoose.Schema(
  {
    examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    attemptNumber: { type: Number, default: 1 },
    startedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
    submittedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: [
        "NOT_STARTED",
        "IN_PROGRESS",
        "SUBMITTED",
        "UNDER_REVIEW",
        "GRADED",
        "PUBLISHED",
      ],
      default: "IN_PROGRESS",
      index: true,
    },
    objectiveScore: { type: Number, default: null },
    subjectiveScore: { type: Number, default: null },
    finalScore: { type: Number, default: null },
    practiceBand: { type: Number, default: null },
    estimatedPteScore: { type: Number, default: null },
    rawScore: { type: Number, default: null },
    maxScore: { type: Number, default: null },
    integrityEvents: { type: [integritySchema], default: [] },
    objectiveEvaluator: { type: Boolean, default: false },
    receipt: { type: String, default: null },
  },
  { timestamps: true },
);

schema.index({ examId: 1, studentId: 1, attemptNumber: 1 }, { unique: true });

export const ExamAttempt: Model<IExamAttempt> = mongoose.model<IExamAttempt>(
  "ExamAttempt",
  schema,
);

export interface IExamAnswer extends Document {
  attemptId: Types.ObjectId;
  examId: Types.ObjectId;
  studentId: Types.ObjectId;
  questionId: Types.ObjectId;
  sectionIndex: number;
  answer: unknown;
  answered: boolean;
  markedForReview?: boolean;
  isObjective?: boolean;
  autoCorrect?: {
    isCorrect: boolean;
    awarded: number;
  } | null;
  updatedAt: Date;
}

const answerSchema = new mongoose.Schema(
  {
    attemptId: { type: mongoose.Schema.Types.ObjectId, ref: "ExamAttempt", required: true, index: true },
    examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: "Question", required: true },
    sectionIndex: { type: Number, default: 0 },
    answer: { type: mongoose.Schema.Types.Mixed, default: null },
    answered: { type: Boolean, default: false },
    isCorrect: { type: Boolean, default: false },
    isObjective: { type: Boolean, default: true },
    autoCorrect: {
      type: new mongoose.Schema(
        {
          isCorrect: { type: Boolean, default: false },
          earnedScore: { type: Number, default: 0 },
        },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true },
);

answerSchema.index({ attemptId: 1, questionId: 1 }, { unique: true });

export const ExamAnswer: Model<IExamAnswer> = mongoose.model<IExamAnswer>("ExamAnswer", answerSchema);