export type UserRole = "SUPER_ADMIN" | "CONSULTANCY" | "TEACHER" | "STUDENT";
export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type UserRoleUnion = UserRole;

export type ExamType = "PRACTICE" | "SECTIONAL" | "MOCK" | "CUSTOM";
export type ExamStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "PUBLISHED"
  | "ARCHIVED"
  | "COMPLETED";

export type AttemptStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "GRADED"
  | "PUBLISHED";

export type QuestionCategory =
  | "IELTS_LISTENING"
  | "IELTS_READING"
  | "IELTS_WRITING"
  | "IELTS_SPEAKING"
  | "PTE_SPEAKING"
  | "PTE_WRITING"
  | "PTE_READING"
  | "PTE_LISTENING";

export type AssignmentStatus = "DRAFT" | "ASSIGNED" | "OPEN" | "CLOSED";
export type SubmissionStatus =
  | "PENDING"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "GRADED"
  | "RETURNED"
  | "RESUBMITTED"
  | "PUBLISHED";

export type GradeStatus = "DRAFT" | "PUBLISHED";
export type AssignmentKind = "EXAM" | "EXERCISE";
export type MediaAssetKind =
  | "PROFILE_IMAGE"
  | "QUESTION_IMAGE"
  | "LISTENING_AUDIO"
  | "SPEAKING_AUDIO"
  | "ASSIGNMENT_FILE"
  | "SUBMISSION_FILE"
  | "AUDIO_FEEDBACK";

export type AIFeedbackType = "WRITING" | "SPEAKING";

export type AiErrorCategory =
  | "grammar"
  | "vocabulary"
  | "coherence"
  | "fluency"
  | "task_response"
  | "spelling"
  | "punctuation";

export type AiAnnotationSeverity = "low" | "medium" | "high";

export interface AiErrorAnnotation {
  start: number;
  end: number;
  original: string;
  correction: string;
  better?: string;
  category: AiErrorCategory | string;
  note: string;
  severity: AiAnnotationSeverity;
}

export interface AiBandSet {
  ielts?: number | null;
  pte?: number | null;
}

export interface AiAnalysisResult {
  overallScore: number;
  skillScores: Record<string, number>;
  bands?: AiBandSet;
  strengths: string[];
  improvements: string[];
  grammar: string[];
  vocabulary: string[];
  coherence: string[];
  fluency: string[];
  pronunciation: string[];
  nextSteps: string[];
  annotations: AiErrorAnnotation[];
  modelAnswer?: string | null;
  advice?: string | null;
  disclaimer: string;
}