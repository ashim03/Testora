import type { QuestionCategory } from "../types";

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  TEACHER: "TEACHER",
  STUDENT: "STUDENT",
} as const;

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  TEACHER: "Teacher",
  STUDENT: "Student",
};

export type Permission =
  | "user.manage"
  | "teacher.manage"
  | "student.manage"
  | "assignment.manage"
  | "course.manage"
  | "batch.manage"
  | "question.manage"
  | "exam.manage"
  | "exam.attempt"
  | "submission.grade"
  | "result.manage"
  | "report.view"
  | "audit.view"
  | "settings.manage"
  | "progress.view";

export const PERMISSIONS: Record<UserRoleLiteral, Permission[]> = {
  SUPER_ADMIN: [
    "user.manage",
    "teacher.manage",
    "student.manage",
    "assignment.manage",
    "course.manage",
    "batch.manage",
    "question.manage",
    "exam.manage",
    "exam.attempt",
    "submission.grade",
    "result.manage",
    "report.view",
    "audit.view",
    "settings.manage",
    "progress.view",
  ],
  TEACHER: [
    "student.manage",
    "batch.manage",
    "question.manage",
    "exam.manage",
    "submission.grade",
    "result.manage",
    "report.view",
    "progress.view",
  ],
  STUDENT: ["exam.attempt", "progress.view"],
};

type UserRoleLiteral = "SUPER_ADMIN" | "TEACHER" | "STUDENT";

export const QUESTION_TYPES = [
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "MULTIPLE_ANSWER",
  "TRUE_FALSE_NOT_GIVEN",
  "YES_NO_NOT_GIVEN",
  "FILL_BLANK",
  "SHORT_ANSWER",
  "MATCHING_HEADINGS",
  "MATCHING_INFORMATION",
  "MATCHING_SENTENCE_ENDING",
  "DRAG_DROP",
  "REORDER_PARAGRAPHS",
  "ESSAY",
  "LETTER",
  "DESCRIBE_IMAGE",
  "READ_ALOUD",
  "REPEAT_SENTENCE",
  "ANSWER_SHORT_QUESTION",
  "RETELL_LECTURE",
  "SUMMARIZE_WRITTEN_TEXT",
  "SUMMARIZE_SPOKEN_TEXT",
  "LISTENING_DICTATION",
  "SPEAKING_RESPONSE",
  "AUDIO_RESPONSE",
  "IMAGE_BASED_RESPONSE",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_CATEGORIES: QuestionCategory[] = [
  "IELTS_LISTENING",
  "IELTS_READING",
  "IELTS_WRITING",
  "IELTS_SPEAKING",
  "PTE_SPEAKING",
  "PTE_WRITING",
  "PTE_READING",
  "PTE_LISTENING",
];

export const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  IELTS_LISTENING: "IELTS Listening",
  IELTS_READING: "IELTS Reading",
  IELTS_WRITING: "IELTS Writing",
  IELTS_SPEAKING: "IELTS Speaking",
  PTE_SPEAKING: "PTE Speaking",
  PTE_WRITING: "PTE Writing",
  PTE_READING: "PTE Reading",
  PTE_LISTENING: "PTE Listening",
};

export type SectionalPart = {
  key: string;
  label: string;
};

export const SECTIONAL_PARTS: Record<string, { label: string; icon: string; parts: SectionalPart[] }> = {
  IELTS_LISTENING: {
    label: "Listening",
    icon: "Headphones",
    parts: [
      { key: "1", label: "Part 1" },
      { key: "2", label: "Part 2" },
      { key: "3", label: "Part 3" },
      { key: "4", label: "Part 4" },
    ],
  },
  IELTS_READING: {
    label: "Reading",
    icon: "BookOpen",
    parts: [
      { key: "1", label: "Passage 1" },
      { key: "2", label: "Passage 2" },
      { key: "3", label: "Passage 3" },
    ],
  },
  IELTS_WRITING: {
    label: "Writing",
    icon: "PenLine",
    parts: [
      { key: "1", label: "Task 1" },
      { key: "2", label: "Task 2" },
    ],
  },
  IELTS_SPEAKING: {
    label: "Speaking",
    icon: "Mic",
    parts: [
      { key: "1", label: "Part 1" },
      { key: "2", label: "Part 2" },
      { key: "3", label: "Part 3" },
    ],
  },
};

export const SECTIONAL_CATEGORIES = Object.keys(SECTIONAL_PARTS);

export const IELTS_WRITING_RUBRIC = [
  { key: "taskResponse", label: "Task Response", max: 9, weight: 25 },
  { key: "coherence", label: "Coherence and Cohesion", max: 9, weight: 25 },
  { key: "lexical", label: "Lexical Resource", max: 9, weight: 25 },
  { key: "grammar", label: "Grammatical Range and Accuracy", max: 9, weight: 25 },
];

export const IELTS_SPEAKING_RUBRIC = [
  { key: "fluency", label: "Fluency and Coherence", max: 9, weight: 25 },
  { key: "lexical", label: "Lexical Resource", max: 9, weight: 25 },
  { key: "grammar", label: "Grammatical Range and Accuracy", max: 9, weight: 25 },
  { key: "pronunciation", label: "Pronunciation", max: 9, weight: 25 },
];

export const PTE_RUBRIC_CRITERIA = [
  { key: "content", label: "Content", max: 5, weight: 20 },
  { key: "form", label: "Form", max: 5, weight: 15 },
  { key: "grammar", label: "Grammar", max: 5, weight: 15 },
  { key: "vocabulary", label: "Vocabulary", max: 5, weight: 15 },
  { key: "spelling", label: "Spelling", max: 5, weight: 10 },
  { key: "oralFluency", label: "Oral Fluency", max: 5, weight: 15 },
  { key: "pronunciation", label: "Pronunciation", max: 5, weight: 10 },
];

export const DIFFICULTY_LEVELS = ["EASY", "MEDIUM", "HARD"] as const;

export const NOTIFICATION_TYPES = [
  "ACCOUNT_CREATED",
  "TEST_ASSIGNED",
  "UPCOMING_TEST",
  "ASSIGNMENT_CREATED",
  "ASSIGNMENT_DEADLINE",
  "SUBMISSION_SUCCESS",
  "RESULT_PUBLISHED",
  "TEACHER_FEEDBACK",
  "PASSWORD_RESET",
  "BATCH_ASSIGNED",
  "COURSE_ENROLLED",
  "COURSE_CONTENT_PUBLISHED",
  "COURSE_ANNOUNCEMENT",
  "ASSIGNMENT_GRADED",
  "ASSIGNMENT_RETURNED",
  "QUIZ_AVAILABLE",
  "EXAM_SCHEDULED",
  "SUBMISSION_RECEIVED",
  "CONTENT_VIEWED",
  "CHAT_MESSAGE",
] as const;

export const COURSE_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "ALL_LEVELS"] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number];

export const LESSON_TYPES = ["VIDEO", "PDF", "DOCUMENT", "PRESENTATION", "NOTES", "LINK", "TEXT", "QUIZ", "ASSIGNMENT"] as const;
export type LessonType = (typeof LESSON_TYPES)[number];

export const MATERIAL_TYPES = ["VIDEO", "PDF", "DOCUMENT", "PRESENTATION", "NOTES", "LINK", "AUDIO"] as const;
export type MaterialType = (typeof MATERIAL_TYPES)[number];

export const ASSIGNMENT_SUBMISSION_TYPES = ["TEXT", "FILE", "TEXT_AND_FILE", "LINK", "AUDIO_VIDEO"] as const;
export type AssignmentSubmissionType = (typeof ASSIGNMENT_SUBMISSION_TYPES)[number];

export const ASSIGNMENT_STATUSES = ["DRAFT", "ASSIGNED", "OPEN", "CLOSED"] as const;

export const SUBMISSION_STATUSES = ["PENDING", "SUBMITTED", "UNDER_REVIEW", "GRADED", "RETURNED", "RESUBMITTED", "PUBLISHED"] as const;

export const PROGRESS_SOURCES = ["LESSON_COMPLETED", "VIDEO_WATCHED", "MATERIAL_VIEWED", "ASSIGNMENT_SUBMITTED", "QUIZ_COMPLETED", "EXAM_COMPLETED"] as const;
export type ProgressSource = (typeof PROGRESS_SOURCES)[number];

export const PRACTICE_DISCLAIMERS = {
  IELTS: "This is a practice assessment and not an official IELTS result.",
  PTE: "This score is for practice purposes and is not an official Pearson PTE score.",
} as const;

export const BAND_LABEL = "IELTS Practice Band";
export const PTE_LABEL = "Estimated PTE Practice Score";
export const TEACHER_SCORE_LABEL = "Teacher-Assessed Score";

export const SUBSCRIPTION_PLANS = [
  { key: "WEEKLY", label: "Weekly", days: 7, price: 10 },
  { key: "MONTHLY", label: "Monthly", days: 30, price: 25 },
  { key: "THREE_MONTHS", label: "3 Months", days: 90, price: 65 },
  { key: "SIX_MONTHS", label: "6 Months", days: 180, price: 120 },
  { key: "YEARLY", label: "1 Year", days: 365, price: 200 },
] as const;

export type SubscriptionPlanKey = (typeof SUBSCRIPTION_PLANS)[number]["key"];

export const SUBSCRIPTION_PLAN_KEYS = SUBSCRIPTION_PLANS.map((p) => p.key) as SubscriptionPlanKey[];

export const SUBSCRIPTION_STATUSES = ["ACTIVE", "EXPIRED", "CANCELLED"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
