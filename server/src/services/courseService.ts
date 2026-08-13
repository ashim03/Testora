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

export async function updateCourse(id: string, data: Record<string, unknown>): Promise<unknown> {
  const course = await Course.findById(id);
  if (!course) throw new ApiError(404, "Course not found");
  if (typeof data.code === "string" && data.code !== course.code) {
    const existing = await Course.findOne({ code: data.code });
    if (existing && String(existing._id) !== id) throw new ApiError(409, "Course code already exists");
  }
  Object.assign(course, data);
  await course.save();
  return course;
}

export async function deleteCourse(id: string): Promise<{ id: string }> {
  const course = await Course.findById(id);
  if (!course) throw new ApiError(404, "Course not found");
  course.active = false;
  await course.save();
  return { id };
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