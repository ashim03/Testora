import mongoose, { type Document, type Model, type Types } from "mongoose";
import type { SpeakingTaskType } from "@testora-platform/shared";

export interface ISpeakingScoreSet {
  overall: number;
  fluency: number;
  grammar: number;
  vocabulary: number;
  coherence: number;
}

export interface ISpeakingMetrics {
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

export interface ISpeakingReport {
  overallScore: number;
  skillScores: ISpeakingScoreSet;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  disclaimer: string;
  providerModel: string | null;
  estimate: boolean;
}

export interface IAudioMetadata {
  assetId: Types.ObjectId;
  url: string;
  mimeType: string;
  format: string;
  sizeBytes: number;
  durationSec: number;
  retained: boolean;
}

export interface ISpeakingAttempt extends Document {
  studentId: Types.ObjectId;
  taskType: SpeakingTaskType;
  title: string;
  prompt: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  error?: string | null;
  keepAudio: boolean;
  audio: IAudioMetadata;
  transcript?: string | null;
  scores?: ISpeakingScoreSet | null;
  metrics?: ISpeakingMetrics | null;
  report?: ISpeakingReport | null;
  processingStartedAt?: Date | null;
  processedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const scoreSetSchema = new mongoose.Schema<ISpeakingScoreSet>(
  {
    overall: { type: Number, min: 0, max: 100, required: true },
    fluency: { type: Number, min: 0, max: 100, required: true },
    grammar: { type: Number, min: 0, max: 100, required: true },
    vocabulary: { type: Number, min: 0, max: 100, required: true },
    coherence: { type: Number, min: 0, max: 100, required: true },
  },
  { _id: false },
);

const metricsSchema = new mongoose.Schema<ISpeakingMetrics>(
  {
    durationSec: { type: Number, min: 0, required: true },
    words: { type: Number, min: 0, required: true },
    sentences: { type: Number, min: 0, required: true },
    wpm: { type: Number, min: 0, required: true },
    fillerWordCount: { type: Number, min: 0, required: true },
    fillerWords: { type: [String], default: [] },
    pauseCount: { type: Number, min: 0, required: true },
    pauseFrequencyPerMinute: { type: Number, min: 0, required: true },
    repetitionCount: { type: Number, min: 0, required: true },
    repeatedPhrases: { type: [String], default: [] },
    avgWordsPerSentence: { type: Number, min: 0, required: true },
    sentenceComplexity: { type: String, enum: ["short", "medium", "complex"], required: true },
    typeTokenRatio: { type: Number, min: 0, max: 1, required: true },
  },
  { _id: false },
);

const reportSchema = new mongoose.Schema<ISpeakingReport>(
  {
    overallScore: { type: Number, min: 0, max: 100, required: true },
    skillScores: { type: scoreSetSchema, required: true },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    recommendations: { type: [String], default: [] },
    disclaimer: { type: String, required: true },
    providerModel: { type: String, default: null },
    estimate: { type: Boolean, default: true },
  },
  { _id: false },
);

const audioMetadataSchema = new mongoose.Schema<IAudioMetadata>(
  {
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: "MediaAsset", required: true },
    url: { type: String, required: true, maxlength: 1000 },
    mimeType: { type: String, required: true, maxlength: 100 },
    format: { type: String, required: true, maxlength: 20 },
    sizeBytes: { type: Number, min: 0, required: true },
    durationSec: { type: Number, min: 0, required: true },
    retained: { type: Boolean, default: true },
  },
  { _id: false },
);

const schema = new mongoose.Schema<ISpeakingAttempt>(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    taskType: { type: String, enum: ["FREE_PRACTICE", "IELTS_PART_1", "IELTS_PART_2", "IELTS_PART_3", "PTE_READ_ALOUD", "PTE_RETELL_LECTURE", "PTE_DESCRIBE_IMAGE"], required: true },
    title: { type: String, required: true, maxlength: 200 },
    prompt: { type: String, required: true, maxlength: 2000, default: "" },
    status: { type: String, enum: ["PROCESSING", "COMPLETED", "FAILED"], required: true, default: "PROCESSING" },
    error: { type: String, default: null },
    keepAudio: { type: Boolean, default: false },
    audio: { type: audioMetadataSchema, required: true },
    transcript: { type: String, default: null, maxlength: 12000 },
    scores: { type: scoreSetSchema, default: null },
    metrics: { type: metricsSchema, default: null },
    report: { type: reportSchema, default: null },
    processingStartedAt: { type: Date, default: null },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ studentId: 1, createdAt: -1 });

export const SpeakingAttempt: Model<ISpeakingAttempt> = mongoose.model<ISpeakingAttempt>("SpeakingAttempt", schema);