export type SpeakingTaskType =
  | "FREE_PRACTICE"
  | "IELTS_PART_1"
  | "IELTS_PART_2"
  | "IELTS_PART_3"
  | "PTE_READ_ALOUD"
  | "PTE_RETELL_LECTURE"
  | "PTE_DESCRIBE_IMAGE";

export type SpeakingAttemptStatus = "PROCESSING" | "COMPLETED" | "FAILED";

export interface SpeakingScores {
  overall: number;
  fluency: number;
  grammar: number;
  vocabulary: number;
  coherence: number;
  taskResponse?: number | null;
}

export interface SpeakingMetrics {
  durationSec: number;
  words: number;
  sentences: number;
  wpm: number;
  fillerWordCount: number;
  fillerWords: string[];
  pauseCount: number;
  pauseFrequencyPerMinute: number;
  repetitionCount: number;
  repeatedPhrases: string[];
  avgWordsPerSentence: number;
  sentenceComplexity: "short" | "medium" | "complex";
  typeTokenRatio: number;
}

export interface SpeakingReport {
  overallScore: number;
  skillScores: SpeakingScores;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  disclaimer: string;
  providerModel: string | null;
  estimate: boolean;
  offTopic?: boolean;
  taskResponseNote?: string | null;
}

export interface SpeakingAttemptSummary {
  id: string;
  taskType: SpeakingTaskType;
  title: string;
  prompt: string;
  status: SpeakingAttemptStatus;
  createdAt: string;
  overallScore: number | null;
  skillScores: SpeakingScores | null;
  metrics: SpeakingMetrics | null;
  error: string | null;
  audioRetained: boolean;
  audioUrl: string | null;
  audioDurationSec: number | null;
}

export interface SpeakingAttemptDetail extends SpeakingAttemptSummary {
  transcript: string | null;
  report: SpeakingReport | null;
}

export interface SpeakingProgress {
  totals: {
    attempts: number;
    completed: number;
    averageOverall: number | null;
    averageWpm: number | null;
  };
  skills: Array<{ skill: string; label: string; score: number; trend: number; attempts: number }>;
  byTaskType: Array<{ taskType: SpeakingTaskType; label: string; count: number; average: number | null }>;
  trend: Array<{ date: string; score: number }>;
  weakestSkill: { skill: string; label: string; score: number } | null;
}
