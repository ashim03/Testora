import mongoose, { type Document, type Model } from "mongoose";
import { ProgressSource } from "@testora-platform/shared";

export interface ICourseEnrollment extends Document {
  courseId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId | null;
  batchId: mongoose.Types.ObjectId | null;
  enrolledBy: mongoose.Types.ObjectId;
  status: "ACTIVE" | "COMPLETED" | "DROPPED";
  progressPercent: number;
  completedLessonCount: number;
  totalLessonCount: number;
  lastAccessedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILessonProgress extends Document {
  courseId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  lessonId: mongoose.Types.ObjectId;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  source: ProgressSource;
  watchedSeconds: number;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMaterialView extends Document {
  courseId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  lessonId: mongoose.Types.ObjectId | null;
  materialId: mongoose.Types.ObjectId;
  viewedAt: Date;
}

const enrollmentSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", default: null },
    enrolledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["ACTIVE", "COMPLETED", "DROPPED"], default: "ACTIVE" },
    progressPercent: { type: Number, default: 0, min: 0, max: 100 },
    completedLessonCount: { type: Number, default: 0 },
    totalLessonCount: { type: Number, default: 0 },
    lastAccessedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
enrollmentSchema.index({ studentId: 1, courseId: 1 }, { unique: true });
enrollmentSchema.index({ studentId: 1, status: 1 });

export const CourseEnrollment: Model<ICourseEnrollment> = mongoose.model<ICourseEnrollment>("CourseEnrollment", enrollmentSchema);

const lessonProgressSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", required: true, index: true },
    status: { type: String, enum: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"], default: "NOT_STARTED" },
    source: { type: String, default: "LESSON_COMPLETED" },
    watchedSeconds: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
lessonProgressSchema.index({ studentId: 1, lessonId: 1 }, { unique: true });
lessonProgressSchema.index({ studentId: 1, courseId: 1, status: 1 });

export const LessonProgress: Model<ILessonProgress> = mongoose.model<ILessonProgress>("LessonProgress", lessonProgressSchema);

const materialViewSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", default: null, index: true },
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: "LearningMaterial", required: true, index: true },
    viewedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export const MaterialView: Model<IMaterialView> = mongoose.model<IMaterialView>("MaterialView", materialViewSchema);
