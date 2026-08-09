import mongoose, { type Document, type Types, type Model } from "mongoose";

export interface IBatch extends Document {
  name: string;
  courseId: Types.ObjectId;
  teacherId?: Types.ObjectId | null;
  studentIds: Types.ObjectId[];
  startDate?: Date | null;
  endDate?: Date | null;
  description: string;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    studentIds: { type: [mongoose.Schema.Types.ObjectId], ref: "User", default: [] },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    description: { type: String, maxlength: 1000, default: "" },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

schema.index({ courseId: 1, archived: 1 });
schema.index({ teacherId: 1 });

export const Batch: Model<IBatch> = mongoose.model<IBatch>("Batch", schema);