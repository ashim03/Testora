import { homePathForRole } from "../config/navigation";

export interface RoutableNotification {
  type?: string;
  data?: Record<string, unknown> | null;
}

export function notificationTarget(notification: RoutableNotification, role?: string): string {
  const home = homePathForRole(role);
  const data = notification.data ?? {};
  const type = notification.type ?? "";

  const id = (key: string) => {
    const value = data[key];
    return typeof value === "string" && value.trim() ? value : "";
  };

  switch (type) {
    case "CHAT_MESSAGE": {
      return `${home}/chat`;
    }
    case "TEST_ASSIGNED":
    case "UPCOMING_TEST":
    case "EXAM_SCHEDULED":
    case "QUIZ_AVAILABLE": {
      if (role === "STUDENT") return "/student/tests";
      return `${home}/exams`;
    }
    case "SUBMISSION_SUCCESS": {
      const attemptId = id("attemptId");
      if (id("assignmentId")) return role === "STUDENT" ? "/student/assignments" : `${home}/assignments`;
      if (role === "STUDENT") return attemptId ? `/student/exam/${attemptId}` : "/student/results";
      return `${home}/submissions`;
    }
    case "SUBMISSION_RECEIVED": {
      return role === "TEACHER" ? "/teacher/submissions" : `${home}/submissions`;
    }
    case "RESULT_PUBLISHED": {
      return role === "STUDENT" ? "/student/results" : `${home}/results`;
    }
    case "TEACHER_FEEDBACK": {
      return role === "STUDENT" ? "/student/feedback" : `${home}/results`;
    }
    case "ASSIGNMENT_CREATED":
    case "ASSIGNMENT_DEADLINE":
    case "ASSIGNMENT_GRADED":
    case "ASSIGNMENT_RETURNED": {
      return role === "STUDENT" ? "/student/assignments" : `${home}/assignments`;
    }
    case "COURSE_ENROLLED":
    case "COURSE_CONTENT_PUBLISHED":
    case "COURSE_ANNOUNCEMENT": {
      const courseId = id("courseId");
      if (role === "STUDENT") return courseId ? `/student/courses/${courseId}` : "/student/courses";
      if (role === "TEACHER") return courseId ? `/teacher/courses/${courseId}` : "/teacher/courses";
      return "/admin/courses";
    }
    case "BATCH_ASSIGNED": {
      return role === "TEACHER" ? "/teacher/batches" : role === "STUDENT" ? "/student/courses" : "/admin/batches";
    }
    case "PASSWORD_RESET": {
      return `${home}/settings`;
    }
    case "ACCOUNT_CREATED": {
      return `${home}/profile`;
    }
    default:
      return `${home}/notifications`;
  }
}
