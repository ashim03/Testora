import mongoose, { type Document, type Model, type Types } from "mongoose";

export type AIFeedbackType = "WRITING" | "SPEAKING";

export interface IAIFeedback extends Document {
  studentId: Types.ObjectId;
  type: AIFeedbackType;
  prompt?: string | null;
  submission: string;
  overallScore: number;
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
  createdAt: Date;
  updatedAt: Date;
}

const schema = new mongoose.Schema<IAIFeedback>({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: ["WRITING", "SPEAKING"], required: true, index: true },
  prompt: { type: String, default: null },
  submission: { type: String, required: true, maxlength: 12000 },
  overallScore: { type: Number, required: true, min: 0, max: 100 },
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
}, { timestamps: true });

schema.index({ studentId: 1, createdAt: -1 });

export const AIFeedback: Model<IAIFeedback> = mongoose.model<IAIFeedback>("AIFeedback", schema);
