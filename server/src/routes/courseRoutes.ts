import { Router } from "express";
import * as courses from "../controllers/courseController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();
router.use(authenticate);

router.get("/my", authorize("STUDENT"), courses.listMyCoursesStudent);
router.get("/:courseId/learn", authorize("STUDENT"), courses.getStudentCourse);
router.patch("/:courseId/lessons/:lessonId/complete", authorize("STUDENT"), courses.markLessonComplete);
router.post("/:courseId/materials/:materialId/view", authorize("STUDENT"), courses.recordMaterialView);

router.get("/teacher/my", authorize("TEACHER", "SUPER_ADMIN"), courses.listMyCourses);
router.get("/:courseId/outline", authorize("TEACHER", "SUPER_ADMIN"), courses.getCourseOutline);
router.get("/:courseId", authorize("TEACHER", "SUPER_ADMIN"), courses.getCourse);
router.post("/:courseId/modules", authorize("TEACHER", "SUPER_ADMIN"), courses.createModule);
router.patch("/modules/:moduleId", authorize("TEACHER", "SUPER_ADMIN"), courses.updateModule);
router.delete("/modules/:moduleId", authorize("TEACHER", "SUPER_ADMIN"), courses.deleteModule);
router.post("/modules/:moduleId/chapters", authorize("TEACHER", "SUPER_ADMIN"), courses.createChapter);
router.patch("/chapters/:chapterId", authorize("TEACHER", "SUPER_ADMIN"), courses.updateChapter);
router.delete("/chapters/:chapterId", authorize("TEACHER", "SUPER_ADMIN"), courses.deleteChapter);
router.post("/chapters/:chapterId/lessons", authorize("TEACHER", "SUPER_ADMIN"), courses.createLesson);
router.patch("/lessons/:lessonId", authorize("TEACHER", "SUPER_ADMIN"), courses.updateLesson);
router.delete("/lessons/:lessonId", authorize("TEACHER", "SUPER_ADMIN"), courses.deleteLesson);
router.post("/lessons/reorder", authorize("TEACHER", "SUPER_ADMIN"), courses.reorderLessons);
router.post("/lessons/:lessonId/materials", authorize("TEACHER", "SUPER_ADMIN"), courses.createMaterial);
router.patch("/materials/:materialId", authorize("TEACHER", "SUPER_ADMIN"), courses.updateMaterial);
router.delete("/materials/:materialId", authorize("TEACHER", "SUPER_ADMIN"), courses.deleteMaterial);
router.post("/:courseId/announcements", authorize("TEACHER", "SUPER_ADMIN"), courses.createAnnouncement);
router.get("/:courseId/announcements", courses.listAnnouncements);
router.delete("/announcements/:announcementId", authorize("TEACHER", "SUPER_ADMIN"), courses.deleteAnnouncement);
router.post("/:courseId/enroll", authorize("TEACHER", "SUPER_ADMIN"), courses.enrollStudents);
router.get("/:courseId/enrollments", authorize("TEACHER", "SUPER_ADMIN"), courses.listEnrollments);
router.delete("/:courseId/enrollments/:studentId", authorize("TEACHER", "SUPER_ADMIN"), courses.dropStudent);

export default router;
