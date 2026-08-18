import fs from "fs";
import { Types } from "mongoose";
import { SPEAKING_TASK_LABELS } from "@testora-platform/shared";
import { config } from "../config";
import { SpeakingAttempt, MediaAsset, LearningProfile } from "../models";
import { getMediaService, localAudioPath } from "./mediaService";
import { getSpeechToTextProvider } from "./stt";
import { type SpeechToTextProvider, SttUnavailableError } from "./stt/speechToTextProvider";
import { validateSpeakingAudio, type AudioFormat } from "../utils/audioValidation";
import { analyzeTranscript, mergeSpeakingScores, OFF_TOPIC_WEAKNESS, OFF_TOPIC_RECOMMENDATION, type SpeakingAnalysisResult } from "./speakingAnalysisService";
import { evaluateLanguage } from "./aiFeedbackService";
import { ApiError } from "../utils/helpers";
import type { ISpeakingAttempt, ISpeakingReport, ISpeakingScoreSet } from "../models/SpeakingAttempt";

export interface CreateSpeakingAttemptInput {
  studentId: string;
  taskType: "FREE_PRACTICE" | "IELTS_PART_1" | "IELTS_PART_2" | "IELTS_PART_3" | "PTE_READ_ALOUD" | "PTE_RETELL_LECTURE" | "PTE_DESCRIBE_IMAGE";
  title: string;
  prompt: string;
  reportedDurationSec: number;
  buffer: Buffer;
  declaredMime: string;
  filename: string;
  keepAudio: boolean;
}

const AI_MODEL = process.env.AI_MODEL || "qwen-plus";
const STUCK_AFTER_MS = 10 * 60 * 1000;

export function toSummary(attempt: ISpeakingAttempt) {
  return {
    id: String(attempt._id),
    taskType: attempt.taskType,
    title: attempt.title,
    prompt: attempt.prompt,
    status: attempt.status,
    createdAt: attempt.createdAt,
    overallScore: attempt.scores?.overall ?? null,
    skillScores: attempt.scores ?? null,
    metrics: attempt.metrics ?? null,
    error: attempt.error ?? null,
    audioRetained: attempt.audio.retained,
    audioUrl: attempt.audio.retained ? attempt.audio.url : null,
    audioDurationSec: attempt.audio.durationSec,
  };
}

function toDetail(attempt: ISpeakingAttempt) {
  return {
    ...toSummary(attempt),
    transcript: attempt.transcript ?? null,
    report: attempt.report ?? null,
  };
}

// ---------------------------------------------------------------------------
// Upload + create
// ---------------------------------------------------------------------------

export async function createSpeakingAttempt(input: CreateSpeakingAttemptInput): Promise<ISpeakingAttempt> {
  const validated = validateSpeakingAudio(input.buffer, input.declaredMime, input.reportedDurationSec, {
    maxDurationSec: config.speaking.maxDurationSec,
    minDurationSec: config.speaking.minDurationSec,
    maxSizeBytes: config.speaking.maxSizeMb * 1024 * 1024,
  });

  const stored = await getMediaService().upload({
    buffer: input.buffer,
    mimeType: validated.mimeType,
    kind: "AUDIO",
    filename: input.filename || `speaking-${Date.now()}.${validated.format}`,
    userId: input.studentId,
  });
  if (!stored.assetId) {
    throw new ApiError(500, "Audio storage failed");
  }

  const attempt = await SpeakingAttempt.create({
    studentId: input.studentId,
    taskType: input.taskType,
    title: input.title || SPEAKING_TASK_LABELS[input.taskType],
    prompt: input.prompt || "",
    status: "PROCESSING",
    keepAudio: input.keepAudio,
    audio: {
      assetId: stored.assetId,
      url: stored.url,
      mimeType: validated.mimeType,
      format: validated.format,
      sizeBytes: validated.sizeBytes,
      durationSec: validated.durationSec,
      retained: true,
    },
  });

  enqueueSpeakingProcessing(String(attempt._id));
  return attempt;
}

// ---------------------------------------------------------------------------
// Background processing
// ---------------------------------------------------------------------------

const queue: string[] = [];
const processing = new Set<string>();
let draining = false;

export function enqueueSpeakingProcessing(attemptId: string): void {
  if (process.env.NODE_ENV === "test") return;
  queue.push(attemptId);
  void drainSpeakingQueue();
}

export async function flushSpeakingQueue(): Promise<void> {
  if (process.env.NODE_ENV === "test") {
    while (queue.length > 0 || processing.size > 0) {
      const batch = queue.splice(0, queue.length);
      if (batch.length === 0 && processing.size === 0) break;
      for (const id of batch) {
        if (processing.has(id)) continue;
        processing.add(id);
        try {
          await processSpeakingAttempt(id);
        } finally {
          processing.delete(id);
          const idx = queue.indexOf(id);
          if (idx >= 0) queue.splice(idx, 1);
        }
      }
    }
    return;
  }
  await drainSpeakingQueue();
}

async function drainSpeakingQueue(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (queue.length > 0) {
      const attemptId = queue.shift();
      if (!attemptId || processing.has(attemptId)) continue;
      processing.add(attemptId);
      try {
        await Promise.race([
          processSpeakingAttempt(attemptId),
          new Promise((_, reject) => setTimeout(() => reject(new Error("speaking processing timeout")), 5 * 60 * 1000)),
        ]);
      } catch (error) {
        // Failed attempts are persisted with their error; the queue moves on.
        console.error("[speaking] background processing failed", attemptId, error instanceof Error ? error.message : error);
        await markFailed(attemptId, "Processing failed unexpectedly. Please retry.");
      } finally {
        processing.delete(attemptId);
      }
    }
  } finally {
    draining = false;
  }
}

export async function processSpeakingAttempt(attemptId: string): Promise<ISpeakingAttempt> {
  const attempt = await SpeakingAttempt.findOne({ _id: attemptId, status: "PROCESSING" });
  if (!attempt) throw new ApiError(404, "Speaking attempt not found or already processed");

  attempt.processingStartedAt = new Date();
  await attempt.save();

  const stt = getSpeechToTextProvider();
  if (!stt) {
    return failAttempt(attempt, "Speech-to-text is not configured. Transcription is disabled on this server.");
  }

  try {
    // 1. Transcription
    const asset = await MediaAsset.findById(attempt.audio.assetId).lean();
    if (!asset) throw new ApiError(404, "Recording file is no longer available");
    let buffer: Buffer;
    if (asset.provider === "local") {
      const filePath = localAudioPath(asset.publicId || String(asset._id));
      if (!fs.existsSync(filePath)) throw new ApiError(404, "Recording file is missing on the server");
      buffer = fs.readFileSync(filePath);
    } else if (asset.url) {
      const response = await fetch(asset.url, { signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw new ApiError(502, "Could not download the recorded audio for transcription");
      buffer = Buffer.from(await response.arrayBuffer());
    } else {
      throw new ApiError(404, "Recording file is no longer available");
    }

    const transcriptShape = await transcribeWithRetry(stt, buffer, attempt);
    const transcript = transcriptShape.text;

    // 2. Local analysis (always computed; AI may refine later)
    const analysis: SpeakingAnalysisResult = analyzeTranscript({
      text: transcript,
      durationSec: attempt.audio.durationSec,
    });

    // 3. AI refinement (optional; falls back cleanly to the heuristic estimate)
    let aiFeedback: Awaited<ReturnType<typeof evaluateLanguage>> | null = null;
    let estimate = true;
    let providerModel: string | null = null;
    let disclaimer = "Heuristic estimate from transcript analysis — not an official IELTS/PTE score.";
    try {
      if (transcript.trim().length >= 20 && process.env.AI_API_KEY) {
        aiFeedback = await evaluateLanguage(
          "SPEAKING",
          transcript.slice(0, 12000),
          attempt.prompt || undefined,
          {
            words: analysis.metrics.words,
            wpm: analysis.metrics.wpm,
            fillerWordCount: analysis.metrics.fillerWordCount,
            pauseFrequencyPerMinute: analysis.metrics.pauseFrequencyPerMinute,
          },
        );
        estimate = false;
        providerModel = AI_MODEL;
        if (aiFeedback.disclaimer) disclaimer = aiFeedback.disclaimer;
      }
    } catch (error) {
      console.error("[speaking] AI evaluation failed; using heuristic estimate", error instanceof Error ? error.message : error);
    }

    const merged = mergeSpeakingScores(analysis, aiFeedback, Boolean(attempt.prompt));
    const scores: ISpeakingScoreSet = merged.scores;

    const strengths = aiFeedback?.strengths?.length ? aiFeedback.strengths.slice(0, 4) : analysis.qualitative.strengths;
    let weaknesses = aiFeedback?.improvements?.length ? aiFeedback.improvements.slice(0, 4) : analysis.qualitative.weaknesses;
    let recommendations = aiFeedback?.nextSteps?.length ? aiFeedback.nextSteps.slice(0, 4) : analysis.qualitative.recommendations;
    if (merged.offTopic) {
      if (!weaknesses.some((w) => w.includes("off topic") || w.includes("off-topic"))) weaknesses = [...weaknesses, OFF_TOPIC_WEAKNESS].slice(0, 4);
      if (!recommendations.some((r) => r.includes("key words in the task"))) recommendations = [...recommendations, OFF_TOPIC_RECOMMENDATION].slice(0, 4);
    }

    const report: ISpeakingReport = {
      overallScore: scores.overall,
      skillScores: scores,
      strengths,
      weaknesses,
      recommendations,
      disclaimer,
      providerModel,
      estimate,
      offTopic: merged.offTopic,
      taskResponseNote: merged.taskResponseNote,
    };

    attempt.transcript = transcript;
    attempt.scores = scores;
    attempt.metrics = analysis.metrics;
    attempt.report = report;

    // 4. Persistence + learning profile
    await attempt.save();
    await updateSpeakingLearningProfile(String(attempt.studentId), scores);

    // 5. Temporary audio: default retention OFF unless explicitly requested
    // or the platform configuration opts in.
    if (!config.speaking.keepAudio && !attempt.keepAudio) {
      await removeAttemptAudio(attempt);
    }

    attempt.status = "COMPLETED";
    attempt.processedAt = new Date();
    await attempt.save();
    return attempt;
  } catch (error) {
    const message = error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Processing failed";
    return failAttempt(attempt, message);
  }
}

async function transcribeWithRetry(stt: SpeechToTextProvider, buffer: Buffer, attempt: ISpeakingAttempt) {
  let lastError: unknown;
  for (let attemptNo = 1; attemptNo <= 2; attemptNo++) {
    try {
      return await stt.transcribe({
        buffer,
        mimeType: attempt.audio.mimeType,
        filename: `speaking-${Date.now()}-${attemptNo}.${attempt.audio.format as AudioFormat}`,
      });
    } catch (error) {
      lastError = error;
      if (attemptNo === 1) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        continue;
      }
      if (error instanceof SttUnavailableError) throw error;
      if (error instanceof ApiError && error.statusCode === 504) throw error;
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new ApiError(502, "Speech-to-text failed");
}

async function removeAttemptAudio(attempt: ISpeakingAttempt): Promise<void> {
  try {
    const asset = await MediaAsset.findById(attempt.audio.assetId).lean();
    if (asset?.publicId) {
      await getMediaService().remove(asset.publicId);
    }
    await MediaAsset.deleteOne({ _id: attempt.audio.assetId });
    attempt.audio.retained = false;
  } catch (error) {
    console.warn("[speaking] audio cleanup failed", error instanceof Error ? error.message : error);
  }
}

async function failAttempt(attempt: ISpeakingAttempt, message: string): Promise<ISpeakingAttempt> {
  attempt.status = "FAILED";
  attempt.error = message;
  attempt.processedAt = new Date();
  await attempt.save();
  return attempt;
}

async function markFailed(attemptId: string, message: string): Promise<void> {
  await SpeakingAttempt.updateOne({ _id: attemptId }, { $set: { status: "FAILED", error: message, processedAt: new Date() } });
}

export async function recoverStuckSpeakingAttempts(): Promise<number> {
  const stuck = await SpeakingAttempt.find({
    status: "PROCESSING",
    processingStartedAt: { $lte: new Date(Date.now() - STUCK_AFTER_MS) },
  }).select("_id");
  for (const attempt of stuck) {
    await SpeakingAttempt.updateOne(
      { _id: attempt._id },
      { $set: { status: "FAILED", error: "Processing did not complete in time. Please retry.", processedAt: new Date() } },
    );
  }
  return stuck.length;
}

// ---------------------------------------------------------------------------
// Queries (ownership is always scoped to the requesting student)
// ---------------------------------------------------------------------------

export async function listSpeakingAttempts(studentId: string, page = 1, limit = 10): Promise<{ data: ReturnType<typeof toSummary>[]; total: number; pages: number }> {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const safePage = Math.max(page, 1);
  const [docs, total] = await Promise.all([
    SpeakingAttempt.find({ studentId }).sort({ createdAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
    SpeakingAttempt.countDocuments({ studentId }),
  ]);
  return {
    // lean docs are re-cast to the document shape for serialization
    data: docs.map((doc) => toSummary(doc as unknown as ISpeakingAttempt)),
    total,
    pages: Math.ceil(total / safeLimit) || 1,
  };
}

export async function getSpeakingAttempt(studentId: string, attemptId: string): Promise<ReturnType<typeof toDetail>> {
  if (!Types.ObjectId.isValid(attemptId)) throw new ApiError(404, "Speaking attempt not found");
  const attempt = await SpeakingAttempt.findOne({ _id: attemptId, studentId }).lean();
  if (!attempt) throw new ApiError(404, "Speaking attempt not found");
  return toDetail(attempt as unknown as ISpeakingAttempt);
}

export async function retrySpeakingAttempt(studentId: string, attemptId: string): Promise<ReturnType<typeof toSummary>> {
  if (!Types.ObjectId.isValid(attemptId)) throw new ApiError(404, "Speaking attempt not found");
  const attempt = await SpeakingAttempt.findOne({ _id: attemptId, studentId });
  if (!attempt) throw new ApiError(404, "Speaking attempt not found");
  if (attempt.status !== "FAILED") throw new ApiError(400, "Only failed attempts can be retried");
  if (!attempt.audio.retained) throw new ApiError(400, "The recording is no longer available for retry");
  attempt.status = "PROCESSING";
  attempt.error = null;
  attempt.processingStartedAt = null;
  attempt.processedAt = null;
  attempt.transcript = null;
  attempt.scores = null;
  attempt.metrics = null;
  attempt.report = null;
  await attempt.save();
  enqueueSpeakingProcessing(String(attempt._id));
  return toSummary(attempt);
}

// ---------------------------------------------------------------------------
// Learning profile (adaptive engine input)
// ---------------------------------------------------------------------------

export async function updateSpeakingLearningProfile(studentId: string, scores: ISpeakingScoreSet): Promise<void> {
  const profile = await LearningProfile.findOneAndUpdate({ studentId }, { $setOnInsert: { studentId } }, { upsert: true, new: true });
  const skills = profile.skills as unknown as Map<string, { score: number; attempts: number; trend: number; lastPracticedAt: Date | null }>;
  const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

  for (const [skill, rawScore] of Object.entries({ fluency: scores.fluency, grammar: scores.grammar, vocabulary: scores.vocabulary, coherence: scores.coherence })) {
    const previous = skills.get(skill) || { score: 50, attempts: 0, trend: 0, lastPracticedAt: null };
    const nextScore = previous.attempts === 0 ? clamp(rawScore) : clamp(previous.score * 0.7 + rawScore * 0.3);
    skills.set(skill, { score: nextScore, attempts: previous.attempts + 1, trend: clamp(nextScore - previous.score), lastPracticedAt: new Date() });
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const last = profile.lastPracticeAt ? new Date(profile.lastPracticeAt) : null;
  const lastDay = last ? new Date(last.getFullYear(), last.getMonth(), last.getDate()) : null;
  if (!lastDay) {
    profile.currentStreak = 1;
  } else {
    const dayDiff = Math.round((today.getTime() - lastDay.getTime()) / 86400000);
    if (dayDiff === 0) {
      // same day: keep streak
    } else if (dayDiff === 1) {
      profile.currentStreak += 1;
    } else {
      profile.currentStreak = 1;
    }
  }

  profile.skills = skills;
  profile.totalPracticeSessions += 1;
  profile.lastPracticeAt = now;
  await profile.save();
}

// ---------------------------------------------------------------------------
// Progress analytics
// ---------------------------------------------------------------------------

export async function getSpeakingProgress(studentId: string) {
  const attempts = await SpeakingAttempt.find({ studentId, status: "COMPLETED" }).sort({ createdAt: -1 }).limit(40).lean();
  const completed = attempts.filter((a) => a.scores && a.metrics);

  const skillKeys: Array<keyof ISpeakingScoreSet> = ["fluency", "grammar", "vocabulary", "coherence"];
  const average = (selector: (a: (typeof attempts)[number]) => number | null | undefined) => {
    const values = attempts.map(selector).filter((v): v is number => typeof v === "number");
    if (values.length === 0) return null;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  };

  const skills = skillKeys.map((skill) => {
    const recentSet = attempts.slice(0, 5).map((a) => a.scores?.[skill]).filter((v): v is number => typeof v === "number");
    const olderSet = attempts.slice(5, 10).map((a) => a.scores?.[skill]).filter((v): v is number => typeof v === "number");
    const recentAvg = recentSet.length ? recentSet.reduce((a, b) => a + b, 0) / recentSet.length : null;
    const olderAvg = olderSet.length ? olderSet.reduce((a, b) => a + b, 0) / olderSet.length : null;
    return {
      skill,
      label: SPEAKING_TASK_LABELS_LOOKUP[skill] ?? skill,
      score: average((a) => a.scores?.[skill]) ?? 0,
      trend: recentAvg !== null && olderAvg !== null ? Math.round(recentAvg - olderAvg) : recentAvg !== null ? Math.round(recentAvg - 50) : 0,
      attempts: attempts.filter((a) => typeof a.scores?.[skill] === "number").length,
    };
  });

  const byTaskTypeMap = new Map<string, { count: number; total: number }>();
  for (const a of attempts) {
    const entry = byTaskTypeMap.get(a.taskType) || { count: 0, total: 0 };
    entry.count += 1;
    if (typeof a.scores?.overall === "number") entry.total += a.scores.overall;
    byTaskTypeMap.set(a.taskType, entry);
  }
  const byTaskType = [...byTaskTypeMap.entries()].map(([taskType, entry]) => ({
    taskType,
    label: SPEAKING_TASK_LABELS[taskType as keyof typeof SPEAKING_TASK_LABELS] ?? taskType,
    count: entry.count,
    average: entry.count ? Math.round(entry.total / entry.count) : null,
  }));

  const weakest = skills.length ? skills.reduce((a, b) => (b.attempts > 0 && (b.score < a.score || a.attempts === 0) ? b : a)) : null;

  return {
    totals: {
      attempts: attempts.length,
      completed: completed.length,
      averageOverall: average((a) => a.scores?.overall),
      averageWpm: average((a) => a.metrics?.wpm),
    },
    skills,
    byTaskType,
    trend: attempts.slice(0, 10).reverse().map((a) => ({ date: new Date(a.createdAt).toISOString().slice(0, 10), score: a.scores?.overall ?? 0 })),
    weakestSkill: weakest && weakest.attempts > 0 ? { skill: weakest.skill, label: weakest.label, score: weakest.score } : null,
  };
}

const SPEAKING_TASK_LABELS_LOOKUP: Record<string, string> = {
  fluency: "Fluency",
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  coherence: "Coherence",
};