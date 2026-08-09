import mongoose, { type Document, type Types, type Model } from "mongoose";

export interface IStudentProfile extends Document {
  userId: Types.ObjectId;
  currentTeacherId?: Types.ObjectId | null;
  currentBatchId?: Types.ObjectId | null;
  enrollingCourseType?: string;
  targetBand?: number;
  examDate?: Date | null;
  notes?: string;
  examType?: string;
  targetScore?: string | null;
  currentLevel?: string | null;
  preferredTestDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    currentTeacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    currentBatchId: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", default: null, index: true },
    enrollingCourseType: { type: String, enum: ["IELTS", "PTE", ""], default: "" },
    targetBand: { type: String, default: "" },
    status: { type: String, default: "" },
    notes: { type: String, maxlength: 1000, default: "" },
    examType: { type: String, enum: ["IELTS", "PTE", ""], default: "" },
    targetScore: { type: String, default: null },
    currentLevel: { type: String, maxlength: 60, default: null },
    preferredTestDate: { type: Date, default: null },
  },
  { timestamps: true },
);

export const StudentProfile: Model<IStudentProfile> = mongoose.model<IStudentProfile>(
  "StudentProfile",
  schema,
);