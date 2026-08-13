import { Types } from "mongoose";
import {
  Course,
  CourseModule,
  CourseChapter,
  Lesson,
  LearningMaterial,
  CourseAnnouncement,
  CourseEnrollment,
  LessonProgress,
  MaterialView,
  Batch,
} from "../models";
import { ApiError, parseSort } from "../utils/helpers";
import { notify, audit } from "./notificationService";

export interface CourseContentQuery {
  page: number;
  limit: number;
  search?: string;
  sort?: string;
  status?: string;
  courseId?: string;
}

async function assertCanManageCourse(courseId: string, actorId: string, role: string): Promise<void> {
  const course = await Course.findById(courseId);
  if (!course) throw new ApiError(404, "Course not found");
  if (role === "SUPER_ADMIN") return;
  if (role === "TEACHER") {
    if (course.instructorId && String(course.instructorId) === actorId) return;
    const owned = await Course.findOne({ _id: courseId, instructorId: actorId });
    if (owned) return;
    throw new ApiError(403, "You are not the instructor of this course");
  }
  throw new ApiError(403, "Forbidden");
}

export async function listCoursesForTeacher(teacherId: string, query: CourseContentQuery): Promise<{ data: unknown[]; total: number; page: number; limit: number; pages: number }> {
  const page = query.page || 1;
  const limit = query.limit || 10;
  const filter: Record<string, unknown> = { active: true, deletedAt: null };
  const instructorCourses = await Course.find({ instructorId: teacherId }).select("_id").lean();
  const ids = new Set<string>(instructorCourses.map((c) => String(c._id)));
  const batchCourses = await Batch.find({ teacherId, archived: false }).select("courseId").lean();
  batchCourses.forEach((b) => ids.add(String(b.courseId)));
  const base = { $or: [{ _id: { $in: [...ids] } }, { instructorId: teacherId }] };
  const mergedFilter = { ...filter, ...base };
  if (query.search) {
    const re = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    (mergedFilter as Record<string, unknown>).name = re;
  }
  const total = await Course.countDocuments(mergedFilter);
  const sort = parseSort(query.sort || "name", ["name", "code", "type", "createdAt"]);
  const data = await Course.find(mergedFilter).sort(sort).skip((page - 1) * limit).limit(limit)
    .populate("instructorId", "firstName lastName email")
    .populate("categoryId", "name");
  return { data, total, page, limit, pages: Math.ceil(total / limit) };
}

async function assertCanViewCourse(courseId: string, actorId: string): Promise<void> {
  const course = await Course.findById(courseId);
  if (!course) throw new ApiError(404, "Course not found");
  if (course.instructorId && String(course.instructorId) === actorId) return;
  const viaBatch = await Batch.findOne({ teacherId: actorId, archived: false, courseId });
  if (viaBatch) return;
  throw new ApiError(403, "You are not authorized to view this course");
}

export async function getCourseFull(courseId: string, role: string, actorId: string): Promise<unknown> {
  if (role !== "SUPER_ADMIN" && role !== "STUDENT") {
    await assertCanViewCourse(courseId, actorId);
  }
  const course = await Course.findById(courseId)
    .populate("instructorId", "firstName lastName email")
    .populate("categoryId", "name");
  if (!course) throw new ApiError(404, "Course not found");
  const modules = await CourseModule.find({ courseId }).sort({ order: 1, createdAt: 1 }).lean();
  const chapters = await CourseChapter.find({ courseId }).sort({ order: 1, createdAt: 1 }).lean();
  const lessons = await Lesson.find({ courseId }).sort({ order: 1, createdAt: 1 }).lean();
  const materials = await LearningMaterial.find({ courseId }).sort({ order: 1, createdAt: 1 }).lean();
  const announcements = await CourseAnnouncement.find({ courseId }).sort({ pinned: -1, createdAt: -1 }).lean();

  const isStudent = role === "STUDENT";
  const visibleLessons = isStudent ? lessons.filter((l) => l.published) : lessons;
  const visibleMaterials = isStudent ? materials.filter((m) => m.published) : materials;

  const tree = modules.map((m) => {
    const moduleId = String(m._id);
    const mChapters = chapters.filter((c) => String(c.moduleId) === moduleId);
    const moduleData: Record<string, unknown> = { ...m, chapters: [] };
    if (!isStudent || m.status === "PUBLISHED") {
      moduleData.chapters = mChapters.map((c) => {
        const chapterId = String(c._id);
        const cLessons = visibleLessons.filter((l) => String(l.chapterId) === chapterId);
        const chapterData: Record<string, unknown> = { ...c, lessons: cLessons.map((l) => {
          const lessonId = String(l._id);
          const lMaterials = visibleMaterials.filter((mat) => String(mat.lessonId) === lessonId);
          return { ...l, materials: lMaterials };
        }) };
        return chapterData;
      });
    }
    return moduleData;
  });

  const enrollment = isStudent
    ? await CourseEnrollment.findOne({ courseId, studentId: actorId, status: "ACTIVE" }).lean()
    : null;

  return { course, modules: tree, announcements, enrollment, lessonCount: visibleLessons.length, materialCount: visibleMaterials.length };
}

export async function getCourseOutline(courseId: string, role: string, actorId: string): Promise<unknown> {
  return getCourseFull(courseId, role, actorId);
}

export async function createModule(courseId: string, data: { title: string; description?: string; order?: number; status?: string }, actor: { id: string; role: string }): Promise<unknown> {
  await assertCanManageCourse(courseId, actor.id, actor.role);
  const count = await CourseModule.countDocuments({ courseId });
  const module = await CourseModule.create({ courseId, ...data, order: data.order ?? count + 1, status: data.status || "DRAFT" });
  await audit("CREATE_MODULE", { actorId: actor.id, actorRole: actor.role, entityType: "CourseModule", entityId: String(module._id), after: { title: module.title } });
  return module;
}

export async function updateModule(moduleId: string, data: Record<string, unknown>, actor: { id: string; role: string }): Promise<unknown> {
  const module = await CourseModule.findById(moduleId);
  if (!module) throw new ApiError(404, "Module not found");
  await assertCanManageCourse(String(module.courseId), actor.id, actor.role);
  Object.assign(module, data);
  await module.save();
  return module;
}

export async function deleteModule(moduleId: string, actor: { id: string; role: string }): Promise<void> {
  const module = await CourseModule.findById(moduleId);
  if (!module) throw new ApiError(404, "Module not found");
  await assertCanManageCourse(String(module.courseId), actor.id, actor.role);
  await CourseChapter.deleteMany({ moduleId });
  await Lesson.deleteMany({ moduleId });
  await LearningMaterial.deleteMany({ moduleId });
  await module.deleteOne();
}

export async function createChapter(moduleId: string, data: { title: string; description?: string; order?: number; status?: string }, actor: { id: string; role: string }): Promise<unknown> {
  const module = await CourseModule.findById(moduleId);
  if (!module) throw new ApiError(404, "Module not found");
  await assertCanManageCourse(String(module.courseId), actor.id, actor.role);
  const count = await CourseChapter.countDocuments({ moduleId });
  const chapter = await CourseChapter.create({ moduleId, courseId: module.courseId, ...data, order: data.order ?? count + 1, status: data.status || "DRAFT" });
  return chapter;
}

export async function updateChapter(chapterId: string, data: Record<string, unknown>, actor: { id: string; role: string }): Promise<unknown> {
  const chapter = await CourseChapter.findById(chapterId);
  if (!chapter) throw new ApiError(404, "Chapter not found");
  await assertCanManageCourse(String(chapter.courseId), actor.id, actor.role);
  Object.assign(chapter, data);
  await chapter.save();
  return chapter;
}

export async function deleteChapter(chapterId: string, actor: { id: string; role: string }): Promise<void> {
  const chapter = await CourseChapter.findById(chapterId);
  if (!chapter) throw new ApiError(404, "Chapter not found");
  await assertCanManageCourse(String(chapter.courseId), actor.id, actor.role);
  await Lesson.deleteMany({ chapterId });
  await LearningMaterial.deleteMany({ chapterId });
  await chapter.deleteOne();
}

export async function createLesson(chapterId: string, data: {
  title: string;
  type?: string;
  summary?: string;
  order?: number;
  published?: boolean;
  durationMin?: number;
}, actor: { id: string; role: string }): Promise<unknown> {
  const chapter = await CourseChapter.findById(chapterId);
  if (!chapter) throw new ApiError(404, "Chapter not found");
  await assertCanManageCourse(String(chapter.courseId), actor.id, actor.role);
  const count = await Lesson.countDocuments({ chapterId });
  const lesson = await Lesson.create({ chapterId, moduleId: chapter.moduleId, courseId: chapter.courseId, ...data, order: data.order ?? count + 1 });
  await audit("CREATE_LESSON", { actorId: actor.id, actorRole: actor.role, entityType: "Lesson", entityId: String(lesson._id), after: { title: lesson.title } });
  return lesson;
}

export async function updateLesson(lessonId: string, data: Record<string, unknown>, actor: { id: string; role: string }): Promise<unknown> {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw new ApiError(404, "Lesson not found");
  await assertCanManageCourse(String(lesson.courseId), actor.id, actor.role);
  const wasUnpublished = !lesson.published;
  Object.assign(lesson, data);
  await lesson.save();
  if (wasUnpublished && lesson.published) {
    const course = await Course.findById(lesson.courseId);
    const enrollments = await CourseEnrollment.find({ courseId: lesson.courseId, status: "ACTIVE" }).select("studentId").lean();
    for (const e of enrollments) {
      await notify(String(e.studentId), "COURSE_CONTENT_PUBLISHED", "New lesson available", `"${lesson.title}" was published in ${course?.name || "your course"}.`, { courseId: String(lesson.courseId), lessonId: String(lesson._id) });
    }
  }
  return lesson;
}

export async function deleteLesson(lessonId: string, actor: { id: string; role: string }): Promise<void> {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw new ApiError(404, "Lesson not found");
  await assertCanManageCourse(String(lesson.courseId), actor.id, actor.role);
  await LearningMaterial.deleteMany({ lessonId });
  await LessonProgress.deleteMany({ lessonId });
  await lesson.deleteOne();
}

export async function reorderLessons(lessonIds: string[], actor: { id: string; role: string }): Promise<void> {
  const lessons = await Lesson.find({ _id: { $in: lessonIds } }).select("courseId").lean();
  const courseIds = new Set(lessons.map((l) => String(l.courseId)));
  for (const cid of courseIds) {
    await assertCanManageCourse(cid, actor.id, actor.role);
  }
  for (let i = 0; i < lessonIds.length; i++) {
    await Lesson.updateOne({ _id: lessonIds[i] }, { $set: { order: i + 1 } });
  }
}

export async function createMaterial(lessonId: string | null, data: {
  courseId: string;
  title: string;
  type: string;
  url?: string | null;
  content?: string;
  order?: number;
  published?: boolean;
  chapterId?: string;
  moduleId?: string;
}, actor: { id: string; role: string }): Promise<unknown> {
  await assertCanManageCourse(data.courseId, actor.id, actor.role);
  let chapterId = data.chapterId || null;
  let moduleId = data.moduleId || null;
  if (lessonId) {
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) throw new ApiError(404, "Lesson not found");
    chapterId = String(lesson.chapterId);
    moduleId = String(lesson.moduleId);
  }
  const count = await LearningMaterial.countDocuments({ lessonId: lessonId || null });
  const material = await LearningMaterial.create({ lessonId: lessonId || null, courseId: data.courseId, chapterId, moduleId, ...data, order: data.order ?? count + 1 });
  return material;
}

export async function updateMaterial(materialId: string, data: Record<string, unknown>, actor: { id: string; role: string }): Promise<unknown> {
  const material = await LearningMaterial.findById(materialId);
  if (!material) throw new ApiError(404, "Material not found");
  await assertCanManageCourse(String(material.courseId), actor.id, actor.role);
  Object.assign(material, data);
  await material.save();
  return material;
}

export async function deleteMaterial(materialId: string, actor: { id: string; role: string }): Promise<void> {
  const material = await LearningMaterial.findById(materialId);
  if (!material) throw new ApiError(404, "Material not found");
  await assertCanManageCourse(String(material.courseId), actor.id, actor.role);
  await material.deleteOne();
}

export async function createAnnouncement(courseId: string, data: { title: string; body: string; pinned?: boolean }, actor: { id: string; role: string }): Promise<unknown> {
  await assertCanManageCourse(courseId, actor.id, actor.role);
  const announcement = await CourseAnnouncement.create({ courseId, ...data, createdBy: actor.id });
  const course = await Course.findById(courseId);
  const enrollments = await CourseEnrollment.find({ courseId, status: "ACTIVE" }).select("studentId").lean();
  for (const e of enrollments) {
    await notify(String(e.studentId), "COURSE_ANNOUNCEMENT", `Announcement: ${announcement.title}`, `${course?.name || "Course"}: ${announcement.body.slice(0, 200)}`, { courseId });
  }
  return announcement;
}

export async function listAnnouncements(courseId: string): Promise<unknown[]> {
  return CourseAnnouncement.find({ courseId }).sort({ pinned: -1, createdAt: -1 }).lean();
}

export async function deleteAnnouncement(announcementId: string, actor: { id: string; role: string }): Promise<void> {
  const announcement = await CourseAnnouncement.findById(announcementId);
  if (!announcement) throw new ApiError(404, "Announcement not found");
  await assertCanManageCourse(String(announcement.courseId), actor.id, actor.role);
  await announcement.deleteOne();
}

export async function enrollStudents(courseId: string, options: { studentIds?: string[]; batchIds?: string[] }, actor: { id: string; role: string }): Promise<{ enrolled: number }> {
  const course = await Course.findById(courseId);
  if (!course) throw new ApiError(404, "Course not found");
  await assertCanManageCourse(courseId, actor.id, actor.role);
  const students = new Set<string>();
  for (const id of options.studentIds || []) students.add(id);
  for (const batchId of options.batchIds || []) {
    const batch = await Batch.findById(batchId);
    if (batch) batch.studentIds.forEach((s) => students.add(String(s)));
  }
  const lessons = await Lesson.countDocuments({ courseId });
  for (const studentId of students) {
    const existing = await CourseEnrollment.findOne({ courseId, studentId });
    if (existing) {
      if (existing.status !== "ACTIVE") {
        existing.status = "ACTIVE";
        await existing.save();
      }
    } else {
      await CourseEnrollment.create({ courseId, studentId, enrolledBy: actor.id, teacherId: actor.role === "TEACHER" ? actor.id : null, totalLessonCount: lessons });
    }
    await notify(studentId, "COURSE_ENROLLED", "Course enrollment", `You have been enrolled in "${course.name}".`, { courseId });
  }
  await audit("ENROLL_STUDENTS", { actorId: actor.id, actorRole: actor.role, entityType: "Course", entityId: courseId, after: { studentCount: students.size } });
  return { enrolled: students.size };
}

export async function listEnrollments(courseId: string, query: { page?: number; limit?: number; search?: string; status?: string }, actor: { id: string; role: string }): Promise<unknown> {
  await assertCanManageCourse(courseId, actor.id, actor.role);
  const page = query.page || 1;
  const limit = query.limit || 10;
  const filter: Record<string, unknown> = { courseId };
  if (query.status) filter.status = query.status;
  const total = await CourseEnrollment.countDocuments(filter);
  const data = await CourseEnrollment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
    .populate("studentId", "firstName lastName email avatarUrl");
  return { data, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function dropStudent(courseId: string, studentId: string, actor: { id: string; role: string }): Promise<void> {
  await assertCanManageCourse(courseId, actor.id, actor.role);
  await CourseEnrollment.updateOne({ courseId, studentId }, { $set: { status: "DROPPED" } });
}

export async function listStudentCourses(studentId: string): Promise<unknown[]> {
  const enrollments = await CourseEnrollment.find({ studentId, status: "ACTIVE" }).sort({ lastAccessedAt: -1, createdAt: -1 }).populate("courseId").lean();
  const courses = [];
  for (const e of enrollments) {
    const course = (e.courseId as unknown as { _id: Types.ObjectId; name: string; code: string; type: string; description: string; thumbnailUrl: string | null; level: string }) || null;
    if (!course || course._id == null) continue;
    const courseObjectId = e.courseId as unknown as Types.ObjectId;
    const total = await Lesson.countDocuments({ courseId: courseObjectId, published: true });
    const completed = await LessonProgress.countDocuments({ courseId: courseObjectId, studentId, status: "COMPLETED" });
    courses.push({
      enrollment: e,
      course,
      progress: total ? Math.round((completed / total) * 100) : 0,
      completedLessons: completed,
      totalLessons: total,
    });
  }
  return courses;
}

export async function markLessonComplete(courseId: string, lessonId: string, studentId: string, source: string = "LESSON_COMPLETED"): Promise<unknown> {
  const validSource = source === "LESSON_COMPLETED" || source === "VIDEO_WATCHED" || source === "MATERIAL_VIEWED" || source === "ASSIGNMENT_SUBMITTED" || source === "QUIZ_COMPLETED" || source === "EXAM_COMPLETED" ? source : "LESSON_COMPLETED";
  const lesson = await Lesson.findOne({ _id: lessonId, courseId, published: true });
  if (!lesson) throw new ApiError(404, "Lesson not found");
  const enrollment = await CourseEnrollment.findOne({ courseId, studentId, status: "ACTIVE" });
  if (!enrollment) throw new ApiError(403, "You are not enrolled in this course");
  const existing = await LessonProgress.findOne({ courseId, studentId, lessonId });
  if (existing) {
    existing.status = "COMPLETED";
    existing.source = validSource;
    existing.completedAt = new Date();
    await existing.save();
  } else {
    await LessonProgress.create({ courseId, studentId, lessonId, status: "COMPLETED", source: validSource, completedAt: new Date() });
  }
  await recalcEnrollmentProgress(enrollment);
  return { success: true };
}

export async function recordMaterialView(courseId: string, lessonId: string | null, materialId: string, studentId: string): Promise<void> {
  const enrollment = await CourseEnrollment.findOne({ courseId, studentId, status: "ACTIVE" });
  if (!enrollment) throw new ApiError(403, "You are not enrolled in this course");
  await MaterialView.updateOne(
    { courseId, studentId, lessonId: lessonId || null, materialId },
    { $set: { viewedAt: new Date() } },
    { upsert: true },
  );
  if (enrollment) {
    enrollment.lastAccessedAt = new Date();
    await enrollment.save();
  }
}

export async function recalcEnrollmentProgress(enrollment: { _id: Types.ObjectId; courseId: Types.ObjectId; studentId: Types.ObjectId }): Promise<void> {
  const total = await Lesson.countDocuments({ courseId: enrollment.courseId, published: true });
  const completed = await LessonProgress.countDocuments({ courseId: enrollment.courseId, studentId: enrollment.studentId, status: "COMPLETED" });
  await CourseEnrollment.updateOne({ _id: enrollment._id }, {
    $set: {
      progressPercent: total ? Math.round((completed / total) * 100) : 0,
      completedLessonCount: completed,
      totalLessonCount: total,
      lastAccessedAt: new Date(),
    },
  });
}

export async function listStudentProgress(courseId: string, studentId: string): Promise<unknown> {
  const lessons = await Lesson.find({ courseId, published: true }).sort({ order: 1 }).select("_id title order type").lean();
  const progress = await LessonProgress.find({ courseId, studentId }).lean();
  const map = new Map(progress.map((p) => [String(p.lessonId), p]));
  return lessons.map((l) => ({ lesson: l, progress: map.get(String(l._id)) || null }));
}

export async function getStudentCourseContent(courseId: string, studentId: string): Promise<unknown> {
  const enrollment = await CourseEnrollment.findOne({ courseId, studentId, status: "ACTIVE" });
  if (!enrollment) throw new ApiError(403, "You are not enrolled in this course");
  const full = await getCourseFull(courseId, "STUDENT", studentId);
  const progress = await listStudentProgress(courseId, studentId);
  return { ...(full as object), progress };
}
