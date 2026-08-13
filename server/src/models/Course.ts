import mongoose, { type Document, type Model } from "mongoose";
import { CourseLevel, LessonType, MaterialType } from "@testora-platform/shared";

export interface ICourse extends Document {
  name: string;
  code: string;
  type: "IELTS" | "PTE";
  description: string;
  active: boolean;
  instructorId: mongoose.Types.ObjectId | null;
  categoryId: mongoose.Types.ObjectId | null;
  categoryName: string;
  level: CourseLevel;
  durationHours: number | null;
  objectives: string[];
  syllabus: string;
  thumbnailUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICourseModule extends Document {
  courseId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  order: number;
  status: "DRAFT" | "PUBLISHED";
  createdAt: Date;
  updatedAt: Date;
}

export interface ICourseChapter extends Document {
  moduleId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  order: number;
  status: "DRAFT" | "PUBLISHED";
  createdAt: Date;
  updatedAt: Date;
}

export interface ILesson extends Document {
  chapterId: mongoose.Types.ObjectId;
  moduleId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  title: string;
  type: LessonType;
  summary: string;
  order: number;
  durationMin: number | null;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILearningMaterial extends Document {
  lessonId: mongoose.Types.ObjectId | null;
  chapterId: mongoose.Types.ObjectId | null;
  moduleId: mongoose.Types.ObjectId | null;
  courseId: mongoose.Types.ObjectId;
  title: string;
  type: MaterialType;
  url: string | null;
  content: string;
  order: number;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICourseAnnouncement extends Document {
  courseId: mongoose.Types.ObjectId;
  title: string;
  body: string;
  createdBy: mongoose.Types.ObjectId;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const courseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    code: { type: String, required: true, trim: true, maxlength: 40 },
    type: { type: String, enum: ["IELTS", "PTE"], required: true },
    description: { type: String, maxlength: 2000, default: "" },
    active: { type: Boolean, default: true },
    instructorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    categoryName: { type: String, default: "" },
    level: { type: String, enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED", "ALL_LEVELS"], default: "ALL_LEVELS" },
    durationHours: { type: Number, default: null },
    objectives: { type: [String], default: [] },
    syllabus: { type: String, default: "" },
    thumbnailUrl: { type: String, default: null },
  },
  { timestamps: true },
);

courseSchema.index({ type: 1, name: 1 });
courseSchema.index({ instructorId: 1, active: 1 });

export const Course: Model<ICourse> = mongoose.model<ICourse>("Course", courseSchema);

const moduleSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 2000, default: "" },
    order: { type: Number, default: 0 },
    status: { type: String, enum: ["DRAFT", "PUBLISHED"], default: "DRAFT" },
  },
  { timestamps: true },
);
moduleSchema.index({ courseId: 1, order: 1 });

export const CourseModule: Model<ICourseModule> = mongoose.model<ICourseModule>("CourseModule", moduleSchema);

const chapterSchema = new mongoose.Schema(
  {
    moduleId: { type: mongoose.Schema.Types.ObjectId, ref: "CourseModule", required: true, index: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 2000, default: "" },
    order: { type: Number, default: 0 },
    status: { type: String, enum: ["DRAFT", "PUBLISHED"], default: "DRAFT" },
  },
  { timestamps: true },
);
chapterSchema.index({ moduleId: 1, order: 1 });

export const CourseChapter: Model<ICourseChapter> = mongoose.model<ICourseChapter>("CourseChapter", chapterSchema);

const lessonSchema = new mongoose.Schema(
  {
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: "CourseChapter", required: true, index: true },
    moduleId: { type: mongoose.Schema.Types.ObjectId, ref: "CourseModule", required: true, index: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    type: {
      type: String,
      enum: ["VIDEO", "PDF", "DOCUMENT", "PRESENTATION", "NOTES", "LINK", "TEXT", "QUIZ", "ASSIGNMENT"],
      default: "TEXT",
    },
    summary: { type: String, maxlength: 2000, default: "" },
    order: { type: Number, default: 0 },
    durationMin: { type: Number, default: null },
    published: { type: Boolean, default: false },
  },
  { timestamps: true },
);
lessonSchema.index({ chapterId: 1, order: 1 });

export const Lesson: Model<ILesson> = mongoose.model<ILesson>("Lesson", lessonSchema);

const materialSchema = new mongoose.Schema(
  {
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", default: null, index: true },
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: "CourseChapter", default: null, index: true },
    moduleId: { type: mongoose.Schema.Types.ObjectId, ref: "CourseModule", default: null, index: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    type: {
      type: String,
      enum: ["VIDEO", "PDF", "DOCUMENT", "PRESENTATION", "NOTES", "LINK", "AUDIO"],
      default: "NOTES",
    },
    url: { type: String, default: null },
    content: { type: String, default: "" },
    order: { type: Number, default: 0 },
    published: { type: Boolean, default: false },
  },
  { timestamps: true },
);
materialSchema.index({ lessonId: 1, order: 1 });

export const LearningMaterial: Model<ILearningMaterial> = mongoose.model<ILearningMaterial>("LearningMaterial", materialSchema);

const announcementSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 4000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const CourseAnnouncement: Model<ICourseAnnouncement> = mongoose.model<ICourseAnnouncement>("CourseAnnouncement", announcementSchema);

export interface ICategory extends Document {
  name: string;
  code?: string;
  type?: "IELTS" | "PTE";
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    code: { type: String, maxlength: 40, default: "" },
    type: { type: String, enum: ["IELTS", "PTE"], default: "IELTS" },
    description: { type: String, maxlength: 500, default: "" },
  },
  { timestamps: true },
);

export const Category: Model<ICategory> = mongoose.model<ICategory>("Category", categorySchema);
