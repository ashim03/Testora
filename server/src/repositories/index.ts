import {
  User,
  Exam,
  ExamAttempt,
  ExamAnswer,
  Question,
  Batch,
  Result,
  TeacherStudentAssignment,
  Assignment,
  AssignmentSubmission,
} from "../models";
import type { Types } from "mongoose";

export const userRepo = {
  findByEmail: (email: string) => User.findOne({ email }),
  findById: (id: string) => User.findById(id),
  countByRole: (role: string) => User.countDocuments({ role, deletedAt: null }),
};

export const examRepo = {
  findAssignable: (id: string) => Exam.findById(id),
  activeForStudent: (studentId: string, ids: Types.ObjectId[]) =>
    Exam.find({ _id: { $in: ids }, deletedAt: null, status: { $in: ["PUBLISHED", "SCHEDULED"] } }),
};

export const attemptRepo = {
  latestFor: (examId: string, studentId: string) =>
    ExamAttempt.findOne({ examId, studentId }).sort({ attemptNumber: -1 }),
  byId: (id: string) => ExamAttempt.findById(id),
};

export const answerRepo = {
  forAttempt: (attemptId: string) => ExamAnswer.find({ attemptId }).lean(),
  upsert: (attemptId: string, questionId: string, answer: unknown) =>
    ExamAnswer.updateOne({ attemptId, questionId }, { $set: { answer } }, { upsert: true }),
};

export const questionRepo = {
  byIds: (ids: Types.ObjectId[]) => Question.find({ _id: { $in: ids }, deletedAt: null }),
  byId: (id: string) => Question.findById(id),
};

export const batchRepo = {
  byId: (id: string) => Batch.findById(id),
};

export const resultRepo = {
  publishedForStudent: (studentId: string) => Result.find({ studentId, published: true }),
};

export const assignmentRepo = {
  activeStudentsOfTeacher: (teacherId: string) =>
    TeacherStudentAssignment.find({ teacherId, status: "ACTIVE", endedAt: null }),
};

export const courseworkRepo = {
  forStudent: (studentId: string) => Assignment.find({ studentIds: studentId, deletedAt: null }),
};

export const courseworkSubmissionRepo = {
  forSubmission: (id: string) => AssignmentSubmission.findById(id),
  byAssignmentAndStudent: (assignmentId: string, studentId: string) =>
    AssignmentSubmission.findOne({ assignmentId, studentId }),
};