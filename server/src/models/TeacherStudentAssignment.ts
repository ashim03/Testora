import mongoose, { type Document, type Types, type Model } from "mongoose";

export interface ITeacherStudentAssignment extends Document {
  teacherId: Types.ObjectId;
  studentId: Types.ObjectId;
  assignedBy: Types.ObjectId;
  assignedAt: Date;
  endedAt?: Date | null;
  status: "ACTIVE" | "TRANSFERRED" | "COMPLETED";
  createdAt: Date;
  updatedAt: Date;
}

const schema = new mongoose.Schema(
  {
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["ACTIVE", "TRANSFERRED", "COMPLETED"],
      default: "ACTIVE",
      index: true,
    },
  },
  { timestamps: true },
);

schema.index({ studentId: 1, status: 1 });

export const TeacherStudentAssignment: Model<ITeacherStudentAssignment> =
  mongoose.model<ITeacherStudentAssignment>("TeacherStudentAssignment", schema);