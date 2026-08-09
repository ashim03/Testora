import { Course, Category } from "../models";
import { ApiError } from "../utils/helpers";

export async function listCourses(): Promise<unknown[]> {
  return Course.find({ active: true }).sort({ type: 1, name: 1 }).lean();
}

export async function createCourse(data: {
  name: string;
  code: string;
  type: "IELTS" | "PTE";
  description?: string;
}): Promise<unknown> {
  const existing = await Course.findOne({ code: data.code });
  if (existing) throw new ApiError(409, "Course code already exists");
  return Course.create(data);
}

export async function listCategories(): Promise<unknown[]> {
  return Category.find({}).sort({ name: 1 }).lean();
}

export async function createCategory(data: {
  name: string;
  code?: string;
  type?: "IELTS" | "PTE";
  description?: string;
}): Promise<unknown> {
  return Category.create(data);
}