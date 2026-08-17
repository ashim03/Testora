import mongoose, { type Document, type Model, type Types } from "mongoose";
import type { AiErrorAnnotation, AiBandSet, AIFeedbackType } from "@testora-platform/shared";

export interface IAIFeedback extends Document {
  studentId: Types.ObjectId;
  type: AIFeedbackType;
  prompt?: string | null;
  submission: string;
  overallScore: number;
  skillScores: Record<string, number>;
  strengths: string[];
  improvements: string[];
  grammar: string[];
  vocabulary: string[];
  coherence: string[];
  fluency: string[];
  pronunciation: string[];
  nextSteps: string[];
  disclaimer: string;
  providerModel: string;
  attemptId?: Types.ObjectId | null;
  examId?: Types.ObjectId | null;
  bands?: AiBandSet | null;
  annotations: AiErrorAnnotation[];
  modelAnswer?: string | null;
  advice?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new mongoose.Schema<IAIFeedback>({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: ["WRITING", "SPEAKING"], required: true, index: true },
  prompt: { type: String, default: null },
  submission: { type: String, required: true, maxlength: 12000 },
  overallScore: { type: Number, required: true, min: 0, max: 100 },
  skillScores: { type: mongoose.Schema.Types.Mixed, default: {} },
  strengths: { type: [String], default: [] },
  improvements: { type: [String], default: [] },
  grammar: { type: [String], default: [] },
  vocabulary: { type: [String], default: [] },
  coherence: { type: [String], default: [] },
  fluency: { type: [String], default: [] },
  pronunciation: { type: [String], default: [] },
  nextSteps: { type: [String], default: [] },
  disclaimer: { type: String, required: true },
  providerModel: { type: String, required: true },
  attemptId: { type: mongoose.Schema.Types.ObjectId, ref: "ExamAttempt", default: null, index: true },
  examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", default: null, index: true },
  bands: { type: mongoose.Schema.Types.Mixed, default: null },
  annotations: { type: [{ start: Number, end: Number, original: String, correction: String, better: String, category: String, note: String, severity: String }], default: [] },
  modelAnswer: { type: String, default: null },
  advice: { type: String, default: null },
}, { timestamps: true });

schema.index({ studentId: 1, createdAt: -1 });
schema.index({ studentId: 1, attemptId: 1 });

export const AIFeedback: Model<IAIFeedback> = mongoose.model<IAIFeedback>("AIFeedback", schema);
