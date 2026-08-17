import mongoose, { type Document, type Model, type Types } from "mongoose";

export interface ISkillMastery {
  score: number;
  attempts: number;
  lastPracticedAt?: Date | null;
  trend: number;
}

export interface ILearningProfile extends Document {
  studentId: Types.ObjectId;
  skills: Map<string, ISkillMastery>;
  totalPracticeSessions: number;
  currentStreak: number;
  lastPracticeAt?: Date | null;
  updatedAt: Date;
}

const masterySchema = new mongoose.Schema<ISkillMastery>({
  score: { type: Number, min: 0, max: 100, default: 50 },
  attempts: { type: Number, min: 0, default: 0 },
  lastPracticedAt: { type: Date, default: null },
  trend: { type: Number, min: -100, max: 100, default: 0 },
}, { _id: false });

const schema = new mongoose.Schema<ILearningProfile>({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  skills: { type: Map, of: masterySchema, default: {} },
  totalPracticeSessions: { type: Number, min: 0, default: 0 },
  currentStreak: { type: Number, min: 0, default: 0 },
  lastPracticeAt: { type: Date, default: null },
}, { timestamps: true });

export const LearningProfile: Model<ILearningProfile> = mongoose.model<ILearningProfile>("LearningProfile", schema);
