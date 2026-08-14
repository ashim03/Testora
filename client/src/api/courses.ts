import { apiGet, apiPost, apiPatch, apiDelete } from "./client";

export interface CourseRow {
  _id: string;
  name: string;
  code: string;
  type: "IELTS" | "PTE";
  description?: string;
  active?: boolean;
  instructorId?: { _id: string; firstName?: string; lastName?: string; email?: string } | string | null;
  categoryId?: { _id: string; name?: string } | string | null;
  categoryName?: string;
  level?: string;
  durationHours?: number | null;
  objectives?: string[];
  syllabus?: string;
  thumbnailUrl?: string | null;
  createdAt?: string;
}

export interface LessonRow {
  _id: string;
  chapterId: string;
  moduleId: string;
  courseId: string;
  title: string;
  type?: string;
  summary?: string;
  order: number;
  durationMin?: number | null;
  published: boolean;
  materials?: MaterialRow[];
}

export interface MaterialRow {
  _id: string;
  lessonId?: string | null;
  chapterId?: string | null;
  moduleId?: string | null;
  courseId: string;
  title: string;
  type: string;
  url?: string | null;
  content?: string;
  order?: number;
  published?: boolean;
}

export interface ChapterRow {
  _id: string;
  moduleId: string;
  courseId: string;
  title: string;
  description?: string;
  order: number;
  status?: "DRAFT" | "PUBLISHED";
  lessons: LessonRow[];
}

export interface ModuleRow {
  _id: string;
  courseId: string;
  title: string;
  description?: string;
  order: number;
  status?: "DRAFT" | "PUBLISHED";
  chapters: ChapterRow[];
}

export interface AnnouncementRow {
  _id: string;
  courseId: string;
  title: string;
  body: string;
  createdBy?: string;
  pinned?: boolean;
  createdAt?: string;
}

export interface EnrollmentRow {
  _id: string;
  courseId: string;
  studentId: { _id: string; firstName?: string; lastName?: string; email?: string } | string;
  status: string;
  progressPercent?: number;
  completedLessonCount?: number;
  totalLessonCount?: number;
  createdAt?: string;
}

export interface ProgressEntry {
  lesson: LessonRow;
  progress: { _id: string; status: string; completedAt?: string | null; source?: string } | null;
}

export interface CourseFull {
  course: CourseRow;
  modules: ModuleRow[];
  announcements: AnnouncementRow[];
  enrollment?: { _id: string; progressPercent?: number; status?: string } | null;
  lessonCount: number;
  materialCount: number;
  progress?: ProgressEntry[];
}

export const courseApi = {
  listTeacherCourses: (params?: Record<string, unknown>) =>
    apiGet<CourseRow[]>("/courses/teacher/my", params),
  getCourse: (id: string) => apiGet<CourseFull>(`/courses/${id}`),
  getOutline: (id: string) => apiGet<CourseFull>(`/courses/${id}/outline`),
  createModule: (courseId: string, body: Record<string, unknown>) =>
    apiPost(`/courses/${courseId}/modules`, body),
  updateModule: (moduleId: string, body: Record<string, unknown>) =>
    apiPatch(`/courses/modules/${moduleId}`, body),
  deleteModule: (moduleId: string) => apiDelete(`/courses/modules/${moduleId}`),
  createChapter: (moduleId: string, body: Record<string, unknown>) =>
    apiPost(`/courses/modules/${moduleId}/chapters`, body),
  updateChapter: (chapterId: string, body: Record<string, unknown>) =>
    apiPatch(`/courses/chapters/${chapterId}`, body),
  deleteChapter: (chapterId: string) => apiDelete(`/courses/chapters/${chapterId}`),
  createLesson: (chapterId: string, body: Record<string, unknown>) =>
    apiPost(`/courses/chapters/${chapterId}/lessons`, body),
  updateLesson: (lessonId: string, body: Record<string, unknown>) =>
    apiPatch(`/courses/lessons/${lessonId}`, body),
  deleteLesson: (lessonId: string) => apiDelete(`/courses/lessons/${lessonId}`),
  createMaterial: (lessonId: string, body: Record<string, unknown>) =>
    apiPost(`/courses/lessons/${lessonId}/materials`, body),
  updateMaterial: (materialId: string, body: Record<string, unknown>) =>
    apiPatch(`/courses/materials/${materialId}`, body),
  deleteMaterial: (materialId: string) => apiDelete(`/courses/materials/${materialId}`),
  createAnnouncement: (courseId: string, body: Record<string, unknown>) =>
    apiPost(`/courses/${courseId}/announcements`, body),
  deleteAnnouncement: (announcementId: string) =>
    apiDelete(`/courses/announcements/${announcementId}`),
  enrollStudents: (courseId: string, body: Record<string, unknown>) =>
    apiPost(`/courses/${courseId}/enroll`, body),
  listEnrollments: (courseId: string, params?: Record<string, unknown>) =>
    apiGet<EnrollmentRow[]>(`/courses/${courseId}/enrollments`, params),
  dropStudent: (courseId: string, studentId: string) =>
    apiDelete(`/courses/${courseId}/enrollments/${studentId}`),
  listStudentCourses: () =>
    apiGet<Array<{ course: CourseRow; enrollment: { _id: string; status: string; lastAccessedAt?: string | null }; progress: number; completedLessons: number; totalLessons: number }>>("/courses/my"),
  setCourseActive: (courseId: string, active: boolean) =>
    apiPatch(`/courses/${courseId}/status`, { active }),
  getStudentCourse: (courseId: string) => apiGet<CourseFull>(`/courses/${courseId}/learn`),
  markLessonComplete: (courseId: string, lessonId: string, source = "LESSON_COMPLETED") =>
    apiPatch(`/courses/${courseId}/lessons/${lessonId}/complete`, { source }),
  recordMaterialView: (courseId: string, lessonId: string, materialId: string) =>
    apiPost(`/courses/${courseId}/materials/${materialId}/view`, { lessonId }),
};

export const assignmentsApi = {
  listTeacher: (params?: Record<string, unknown>) =>
    apiGet<unknown[]>("/exams/assignments", params),
  getTeacher: (id: string) => apiGet<unknown>(`/exams/assignments/${id}`),
  create: (body: Record<string, unknown>) => apiPost("/exams/assignments", body),
  update: (id: string, body: Record<string, unknown>) => apiPatch(`/exams/assignments/${id}`, body),
  publish: (id: string) => apiPost(`/exams/assignments/${id}/publish`),
  duplicate: (id: string, body?: Record<string, unknown>) => apiPost(`/exams/assignments/${id}/duplicate`, body ?? {}),
  delete: (id: string) => apiDelete(`/exams/assignments/${id}`),
  listSubmissions: (assignmentId: string, params?: Record<string, unknown>) =>
    apiGet<unknown[]>(`/exams/assignments/${assignmentId}/submissions`, params),
  listAllSubmissions: (params?: Record<string, unknown>) =>
    apiGet<unknown[]>("/exams/assignment-submissions", params),
  gradeSubmission: (id: string, body: Record<string, unknown>) =>
    apiPost(`/exams/assignment-submissions/${id}/grade`, body),
};
