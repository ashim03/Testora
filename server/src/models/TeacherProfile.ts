import mongoose, { type Document, type Types, type Model } from "mongoose";

export interface ITeacherProfile extends Document {
  userId: Types.ObjectId;
  qualification?: string;
  specializations?: string[];
  bio?: string;
  studentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    qualification: { type: String, maxlength: 300, default: "" },
    specializations: { type: [String], default: [] },
    bio: { type: String, maxlength: 1000, default: "" },
    studentCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const TeacherProfile: Model<ITeacherProfile> = mongoose.model<ITeacherProfile>(
  "TeacherProfile",
  schema,
);