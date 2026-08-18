import { FILLER_WORDS, DISCOURSE_MARKERS } from "@testora-platform/shared";
import type { AiAnalysisResult } from "@testora-platform/shared";

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

export interface SpeakingScores {
  overall: number;
  fluency: number;
  grammar: number;
  vocabulary: number;
  coherence: number;
  taskResponse?: number | null;
}

export interface QualitativeFeedback {
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface MergedSpeakingScoring {
  scores: SpeakingScores;
  offTopic: boolean;
  taskResponseNote: string | null;
}

export const OFF_TOPIC_WEAKNESS = "Your response drifted off the task topic — focus on directly answering the question.";
export const OFF_TOPIC_RECOMMENDATION = "Before speaking, note the key words in the task and answer every part of it.";
const TASK_RESPONSE_THRESHOLD = 40;

export interface SpeakingAnalysisResult {
  metrics: SpeakingMetrics;
  scores: SpeakingScores;
  qualitative: QualitativeFeedback;
  estimate: boolean;
}

export interface MeasuredPauses {
  pauseCount: number;
  totalSilenceSec: number;
  speakingSec: number;
  pauseFrequencyPerMinute: number;
}

export interface AnalysisInput {
  text: string;
  durationSec: number;
  measured?: MeasuredPauses | null;
}

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const FILLER_SET = new Set<string>(FILLER_WORDS);
const MARKER_SET = new Set<string>(DISCOURSE_MARKERS);
const WORDS_PER_SECOND = 2.5; // ≈150 wpm speaking rate used to model pause time
const PAUSE_ESTIMATE_SEC = 1.25;

export function tokenizeWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]+(?:'[a-z]+)*/g) || []);
}

export function splitSentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]*/g) || []).map((s) => s.trim()).filter((s) => s.length > 0);
}

export function countFillerWords(words: string[]): { count: number; items: string[] } {
  const counts = new Map<string, number>();
  let total = 0;
  for (const word of words) {
    if (FILLER_SET.has(word)) {
      total += 1;
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  }
  const items = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([word, n]) => `${word} (×${n})`);
  return { count: total, items };
}

export function detectRepeatedPhrases(words: string[], maxGrams = 3): { count: number; phrases: string[] } {
  const seen = new Map<string, number>();
  for (let size = 2; size <= maxGrams; size++) {
    for (let i = 0; i <= words.length - size; i++) {
      const phrase = words.slice(i, i + size).join(" ");
      seen.set(phrase, (seen.get(phrase) || 0) + 1);
    }
  }
  const repeated = [...seen.entries()].filter(([, n]) => n >= 3 && n > words.length / 40).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return { count: repeated.length, phrases: repeated.map(([p, n]) => `${p} (×${n})`) };
}

export function countDiscourseMarkers(words: string[]): number {
  let total = 0;
  for (let i = 0; i < words.length; i++) {
    if (MARKER_SET.has(words[i])) total += 1;
  }
  return total;
}

export function analyzeTranscript(input: AnalysisInput): SpeakingAnalysisResult {
  const { text, durationSec, measured } = input;
  const words = tokenizeWords(text);
  const sentences = splitSentences(text);
  const wordCount = words.length;
  const sentenceCount = Math.max(sentences.length, 1);
  const minutes = Math.max(durationSec, 1) / 60;

  const usesMeasuredPauses = Boolean(measured && measured.speakingSec > 0 && measured.pauseCount >= 0);
  const wpm = usesMeasuredPauses
    ? wordCount / (Math.max((measured as MeasuredPauses).speakingSec, 1) / 60)
    : wordCount / minutes;

  const { count: fillerWordCount, items: fillerWords } = countFillerWords(words);
  const { count: repetitionCount, phrases: repeatedPhrases } = detectRepeatedPhrases(words);

  let pauseCount: number;
  let pauseFrequencyPerMinute: number;
  if (usesMeasuredPauses) {
    // Real pauses detected from the audio with silence detection.
    pauseCount = (measured as MeasuredPauses).pauseCount;
    pauseFrequencyPerMinute = (measured as MeasuredPauses).pauseFrequencyPerMinute;
  } else {
    // Estimated pauses: the recording duration beyond what the spoken words
    // plausibly take, divided by an average pause length.
    const speakingEstimateSec = wordCount / WORDS_PER_SECOND;
    const silentSec = Math.max(0, durationSec - speakingEstimateSec);
    pauseCount = Math.round(silentSec / PAUSE_ESTIMATE_SEC);
    pauseFrequencyPerMinute = durationSec > 0 ? (pauseCount / minutes) : 0;
  }

  const avgWordsPerSentence = wordCount / sentenceCount;
  const sentenceComplexity: "short" | "medium" | "complex" = avgWordsPerSentence < 8 ? "short" : avgWordsPerSentence > 16 ? "complex" : "medium";

  const unique = new Set(words);
  const typeTokenRatio = wordCount > 0 ? unique.size / wordCount : 0;
  const avgWordLength = wordCount > 0 ? words.reduce((sum, w) => sum + w.length, 0) / wordCount : 0;
  const longWordRatio = wordCount > 0 ? words.filter((w) => w.length >= 7).length / wordCount : 0;
  const markerDensity = wordCount > 0 ? countDiscourseMarkers(words) / wordCount : 0;
  const fillerDensity = wordCount > 0 ? fillerWordCount / wordCount : 0;

  // --- Fluency ----------------------------------------------------------
  const wpmScore = clampScore(100 - Math.abs(wpm - 150) * 0.55);
  const pausesScore = clampScore(100 - pauseFrequencyPerMinute * 4.5);
  const fillerScore = clampScore(100 - fillerDensity * 1000);
  const fluency = clampScore(wpmScore * 0.4 + pausesScore * 0.3 + fillerScore * 0.3);

  // --- Vocabulary -------------------------------------------------------
  const ttrScore = clampScore(100 - Math.max(0, 0.72 - typeTokenRatio) * 220);
  const lengthScore = clampScore(50 + (avgWordLength - 4.2) * 30);
  const richnessScore = clampScore(50 + longWordRatio * 220);
  const vocabulary = clampScore(ttrScore * 0.4 + lengthScore * 0.3 + richnessScore * 0.3);

  // --- Coherence --------------------------------------------------------
  const markerScore = clampScore(100 - Math.abs(markerDensity - 0.04) * 1200);
  const sentenceScore = clampScore(100 - Math.max(0, 24 - avgWordsPerSentence) * 2.4 - Math.max(0, avgWordsPerSentence - 30) * 1.2);
  const coherence = clampScore(markerScore * 0.55 + sentenceScore * 0.45);

  // --- Grammar (heuristic) ----------------------------------------------
  // Proxies for grammatical control that are measurable from a transcript:
  // well-formed sentence lengths, sentence variety, freedom from verbatim
  // repetition. Replaced by AI scores when an AI provider is available.
  const varietyScore = clampScore(100 - Math.max(0, Math.abs(avgWordsPerSentence - 15) - 8) * 6);
  const repetitionPenalty = clampScore(100 - repetitionCount * 7);
  const grammar = clampScore(varietyScore * 0.5 + repetitionPenalty * 0.5);

  const overall = clampScore(fluency * 0.3 + grammar * 0.25 + vocabulary * 0.25 + coherence * 0.2);

  const metrics: SpeakingMetrics = {
    durationSec: Math.max(0, Math.round(durationSec)),
    words: wordCount,
    sentences: sentenceCount,
    wpm: Math.round(wpm),
    fillerWordCount,
    fillerWords,
    pauseCount,
    pauseFrequencyPerMinute: Math.round(pauseFrequencyPerMinute * 10) / 10,
    repetitionCount,
    repeatedPhrases,
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
    sentenceComplexity,
    typeTokenRatio: Math.round(typeTokenRatio * 100) / 100,
  };

  const scores: SpeakingScores = { overall, fluency, grammar, vocabulary, coherence, taskResponse: null };
  const qualitative = buildQualitativeFeedback(metrics, { typeTokenRatio, longWordRatio });

  return { metrics, scores, qualitative, estimate: !usesMeasuredPauses };
}

/**
 * Combines the heuristic analysis with optional AI scores and derives the
 * final score set. Fluency is always taken from the measured delivery
 * metrics (WPM, fillers, pauses, repetition) because the AI only sees the
 * transcript text and cannot judge pace or pauses reliably. The AI scores
 * grammar, vocabulary, coherence, and topic adherence (taskResponse), which
 * are the criteria a transcript actually shows. Topic adherence is weighted
 * highest so a fluent but irrelevant answer cannot earn a high overall score.
 */
export function mergeSpeakingScores(
  analysis: SpeakingAnalysisResult,
  ai: Pick<AiAnalysisResult, "overallScore" | "skillScores"> | null,
  hasPrompt: boolean,
): MergedSpeakingScoring {
  if (!ai) {
    return { scores: { ...analysis.scores, taskResponse: null }, offTopic: false, taskResponseNote: null };
  }
  const pick = (key: "grammar" | "vocabulary" | "coherence") => {
    const value = ai.skillScores[key];
    return typeof value === "number" && Number.isFinite(value) ? clampScore(value) : analysis.scores[key];
  };
  const rawTaskResponse = ai.skillScores.taskResponse;
  const taskResponse = typeof rawTaskResponse === "number" && Number.isFinite(rawTaskResponse) ? clampScore(rawTaskResponse) : null;
  const fluency = analysis.scores.fluency;
  const base = { fluency, grammar: pick("grammar"), vocabulary: pick("vocabulary"), coherence: pick("coherence") };
  const offTopic = taskResponse !== null && taskResponse < TASK_RESPONSE_THRESHOLD;
  let overall: number;
  let taskResponseNote: string | null = null;
  if (taskResponse !== null) {
    overall = clampScore(taskResponse * 0.25 + base.fluency * 0.25 + base.grammar * 0.2 + base.vocabulary * 0.2 + base.coherence * 0.1);
    if (offTopic) taskResponseNote = "Your response appears to have gone off topic, which lowered your overall score.";
  } else {
    overall = clampScore(ai.overallScore);
    if (!hasPrompt) taskResponseNote = "Topic relevance was not assessed because no task prompt was provided for this attempt.";
  }
  return { scores: { ...base, overall, taskResponse }, offTopic, taskResponseNote };
}

function buildQualitativeFeedback(metrics: SpeakingMetrics, richness: { typeTokenRatio: number; longWordRatio: number }): QualitativeFeedback {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  if (metrics.words === 0) {
    weaknesses.push("No intelligible speech was detected in the recording.");
    recommendations.push("Check the microphone volume and record in a quiet room.");
    return { strengths, weaknesses, recommendations };
  }

  if (metrics.wpm >= 120 && metrics.wpm <= 180) strengths.push(`Good speaking pace (${metrics.wpm} words per minute).`);
  else if (metrics.wpm < 100) weaknesses.push(`Slow delivery (${metrics.wpm} WPM)`);
  else if (metrics.wpm > 200) weaknesses.push(`Very fast delivery (${metrics.wpm} WPM) — clarity may suffer`);

  if (metrics.pauseFrequencyPerMinute > 6) {
    weaknesses.push(`Long pauses (${metrics.pauseFrequencyPerMinute}/min)`);
    recommendations.push("Practice speaking continuously for 2 minutes without stopping.");
  } else if (metrics.pauseFrequencyPerMinute <= 3) {
    strengths.push("Even rhythm with few pauses.");
  }

  if (metrics.fillerWordCount >= 5) {
    weaknesses.push(`Repeated filler words (${metrics.fillerWords.slice(0, 3).join(", ")})`);
    recommendations.push("Pause silently instead of using filler words; review filler-word mistakes in your transcript.");
  } else if (metrics.fillerWordCount > 0) {
    strengths.push("Controlled use of fillers.");
  }

  if (richness.typeTokenRatio >= 0.6) strengths.push("Good vocabulary range.");
  else {
    weaknesses.push("Limited vocabulary variety.");
    recommendations.push("Review synonyms and topic vocabulary before speaking.");
  }
  if (richness.longWordRatio >= 0.16) strengths.push("Good use of advanced vocabulary.");

  if (metrics.avgWordsPerSentence >= 8 && metrics.avgWordsPerSentence <= 18) {
    strengths.push("Clear, well-developed sentences.");
  } else if (metrics.avgWordsPerSentence < 8) {
    weaknesses.push("Very short, undeveloped sentences.");
    recommendations.push("Link your ideas with connectors (first, however, as a result).");
  }

  if (metrics.repetitionCount > 0) {
    weaknesses.push(`Repetition (${metrics.repeatedPhrases.slice(0, 2).join(", ")})`);
    recommendations.push("Vary how you start sentences to reduce repetition.");
  }
  if (metrics.sentenceComplexity === "short") recommendations.push("Practice forming complex sentences with subordinate clauses.");

  if (recommendations.length === 0) recommendations.push("Keep practicing 2-minute responses to maintain your speaking routine.");
  if (strengths.length === 0) strengths.push("You completed the speaking task — a good step toward fluency.");

  return { strengths: strengths.slice(0, 4), weaknesses: weaknesses.slice(0, 4), recommendations: recommendations.slice(0, 4) };
}