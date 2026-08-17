import mongoose, { type Document, type Types, type Model } from "mongoose";

export type AssignmentStatus = "DRAFT" | "SCHEDULED" | "ASSIGNED" | "OPEN" | "CLOSED";

export interface IAssignment extends Document {
  createdBy: Types.ObjectId;
  title: string;
  description: string;
  instructions: string;
  examId?: Types.ObjectId | null;
  questionIds: Types.ObjectId[];
  studentIds: Types.ObjectId[];
  batchIds: Types.ObjectId[];
  dueAt?: Date | null;
  publishAt?: Date | null;
  reminderHoursBefore: number[];
  reminderSentAt: Date[];
  maxMarks: number;
  attachments: string[];
  status: AssignmentStatus;
  courseId?: Types.ObjectId | null;
  moduleId?: Types.ObjectId | null;
  chapterId?: Types.ObjectId | null;
  lessonId?: Types.ObjectId | null;
  submissionType: "TEXT" | "FILE" | "TEXT_AND_FILE" | "LINK" | "AUDIO_VIDEO";
  allowedFileTypes: string[];
  requiresAttachment: boolean;
  allowResubmission: boolean;
  published: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new mongoose.Schema(
  {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "" },
    instructions: { type: String, default: "" },
    examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", default: null },
    questionIds: { type: [mongoose.Schema.Types.ObjectId], ref: "Question", default: [] },
    studentIds: { type: [mongoose.Schema.Types.ObjectId], ref: "User", default: [] },
    batchIds: { type: [mongoose.Schema.Types.ObjectId], ref: "Batch", default: [] },
    dueAt: { type: Date, default: null, index: true },
    publishAt: { type: Date, default: null, index: true },
    reminderHoursBefore: { type: [Number], default: [24, 1] },
    reminderSentAt: { type: [Date], default: [] },
    maxMarks: { type: Number, default: 50 },
    attachments: { type: [String], default: [] },
    status: { type: String, enum: ["DRAFT", "SCHEDULED", "ASSIGNED", "OPEN", "CLOSED"], default: "DRAFT" },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", default: null, index: true },
    moduleId: { type: mongoose.Schema.Types.ObjectId, ref: "CourseModule", default: null },
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: "CourseChapter", default: null },
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", default: null },
    submissionType: { type: String, enum: ["TEXT", "FILE", "TEXT_AND_FILE", "LINK", "AUDIO_VIDEO"], default: "TEXT" },
    allowedFileTypes: { type: [String], default: [] },
    requiresAttachment: { type: Boolean, default: false },
    allowResubmission: { type: Boolean, default: true },
    published: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ createdBy: 1, status: 1 });
schema.index({ courseId: 1, status: 1 });
schema.index({ publishAt: 1, status: 1, deletedAt: 1 });
schema.index({ dueAt: 1, status: 1, deletedAt: 1 });

export const Assignment: Model<IAssignment> = mongoose.model<IAssignment>("Assignment", schema);

export type SubmissionStatus = "PENDING" | "SUBMITTED" | "UNDER_REVIEW" | "GRADED" | "RETURNED" | "RESUBMITTED" | "PUBLISHED";

export interface IAssignmentSubmission extends Document {
  assignmentId: Types.ObjectId;
  studentId: Types.ObjectId;
  teacherId?: Types.ObjectId | null;
  content: string;
  files: string[];
  submittedAt?: Date | null;
  marks?: number | null;
  maxMarks?: number | null;
  feedback?: string | null;
  strengths?: string[];
  improvements?: string[];
  isDraft?: boolean;
  status: SubmissionStatus;
  returnReason?: string | null;
  gradedBy?: Types.ObjectId | null;
  gradedAt?: Date | null;
  published?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const submissionSchema = new mongoose.Schema(
  {
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment", required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    content: { type: String, default: "" },
    files: { type: [String], default: [] },
    submittedAt: { type: Date, default: null },
    marks: { type: Number, default: null },
    maxMarks: { type: Number, default: null },
    feedback: { type: String, default: null },
    strengths: { type: [String], default: [] },
    improvements: { type: [String], default: [] },
    isDraft: { type: Boolean, default: true },
    status: { type: String, enum: ["PENDING", "SUBMITTED", "UNDER_REVIEW", "GRADED", "RETURNED", "RESUBMITTED", "PUBLISHED"], default: "PENDING", index: true },
    submittedReason: { type: String, default: null },
    returnReason: { type: String, default: null },
    gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    gradedAt: { type: Date, default: null },
    published: { type: Boolean, default: false },
  },
  { timestamps: true },
);

submissionSchema.index({ assignmentId: 1, studentId: 1 });

export const AssignmentSubmission: Model<IAssignmentSubmission> = mongoose.model<IAssignmentSubmission>("AssignmentSubmission", submissionSchema);

export interface IRubric extends Document {
  name: string;
  type: "IELTS_WRITING" | "IELTS_SPEAKING" | "PTE";
  createdBy: Types.ObjectId;
  criteria: Array<{ key: string; label: string; max: number; weight: number }>;
  createdAt: Date;
  updatedAt: Date;
}

const rubricSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: ["IELTS_WRITING", "IELTS_SPEAKING", "PTE"], required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    criteria: { type: [{ key: String, label: String, max: Number, weight: Number }], default: [] },
  },
  { timestamps: true },
);

export const Rubric: Model<IRubric> = mongoose.model<IRubric>("Rubric", rubricSchema);
