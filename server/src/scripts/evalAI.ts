import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { EVAL_SPEAKING, EVAL_WRITING, type EvalSummary } from "../tests/eval/ieltsDataset";
import { SYNTHETIC_SPEAKING, SYNTHETIC_WRITING } from "../tests/eval/syntheticDataset";
import { applyWritingTaskResponse, evaluateLanguage } from "../services/aiFeedbackService";
import { analyzeTranscript, mergeSpeakingScores } from "../services/speakingAnalysisService";
import { AIFeedback } from "../models/AIFeedback";
import { ExamAttempt } from "../models/ExamAttempt";

const absError = (expected: number, predicted: number | null | undefined) =>
  typeof predicted === "number" ? Math.abs(expected - predicted) : null;

interface LabeledSample {
  name: string;
  prompt: string;
  expectedIelts: number;
  expectedPte?: number | null;
  essay?: string;
  transcript?: string;
  durationSec?: number;
}

interface EvalRow {
  name: string;
  expected: number;
  predicted: number | null;
  error: number | null;
  expectedPte: number | null;
  predictedPte: number | null;
  pteError: number | null;
}

interface FeedbackView {
  skillScores: Record<string, number>;
  mergedScores?: {
    fluency: number;
    grammar: number;
    vocabulary: number;
    coherence: number;
    taskResponse: number | null;
  };
}

const maeOf = (errors: Array<number | null>): number | null => {
  const valid = errors.filter((e): e is number => e !== null);
  return valid.length ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 100) / 100 : null;
};

const commonRow = (sample: LabeledSample, predicted: number | null, predictedPte: number | null, error: number | null, pteError: number | null): EvalRow => ({
  name: sample.name,
  expected: sample.expectedIelts,
  predicted,
  error,
  expectedPte: sample.expectedPte ?? null,
  predictedPte,
  pteError,
});

async function runLabeledSamples<T extends EvalRow>(
  samples: LabeledSample[],
  dest: T[],
  makeRow: (row: EvalRow, view: FeedbackView) => T,
  sectionLabel: string
) {
  console.log(`--- ${sectionLabel}: Writing (expected band vs predicted) ---`);
  for (const sample of samples.filter((s) => s.essay != null)) {
    try {
      let feedback = await evaluateLanguage("WRITING", sample.essay!, sample.prompt);
      const applied = applyWritingTaskResponse(feedback, sample.prompt);
      feedback = applied.feedback;
      const predicted = feedback.bands?.ielts ?? null;
      const predictedPte = feedback.bands?.pte ?? null;
      const error = absError(sample.expectedIelts, predicted);
      const pteError = sample.expectedPte != null ? absError(sample.expectedPte, predictedPte) : null;
      dest.push(makeRow(commonRow(sample, predicted, predictedPte, error, pteError), { skillScores: feedback.skillScores }));
      console.log(`${sample.name.padEnd(16)} expected ${sample.expectedIelts} → predicted ${predicted ?? "null"}  (err ${error ?? "?"})${sample.expectedPte != null ? `  PTE expected ${sample.expectedPte} → ${predictedPte ?? "null"} (err ${pteError ?? "?"})` : ""}  scores ${JSON.stringify(feedback.skillScores)}`);
    } catch (error) {
      dest.push(makeRow(commonRow(sample, null, null, null, null), { skillScores: {} }));
      console.error(`${sample.name}: FAILED`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`\n--- ${sectionLabel}: Speaking (expected band vs predicted, fluency measured) ---`);
  for (const sample of samples.filter((s) => s.transcript != null)) {
    try {
      const analysis = analyzeTranscript({ text: sample.transcript!, durationSec: sample.durationSec ?? 40 });
      const ai = await evaluateLanguage("SPEAKING", sample.transcript!, sample.prompt, {
        words: analysis.metrics.words,
        wpm: analysis.metrics.wpm,
        fillerWordCount: analysis.metrics.fillerWordCount,
        pauseFrequencyPerMinute: analysis.metrics.pauseFrequencyPerMinute,
      });
      const merged = mergeSpeakingScores(analysis, ai, true);
      const predicted = ai.bands?.ielts ?? null;
      const predictedPte = ai.bands?.pte ?? null;
      const error = absError(sample.expectedIelts, predicted);
      const pteError = sample.expectedPte != null ? absError(sample.expectedPte, predictedPte) : null;
      dest.push(
        makeRow(commonRow(sample, predicted, predictedPte, error, pteError), {
          skillScores: ai.skillScores,
          mergedScores: {
            fluency: merged.scores.fluency,
            grammar: merged.scores.grammar,
            vocabulary: merged.scores.vocabulary,
            coherence: merged.scores.coherence,
            taskResponse: merged.scores.taskResponse ?? null,
          },
        })
      );
      console.log(`${sample.name.padEnd(16)} expected ${sample.expectedIelts} → predicted ${predicted ?? "null"}  (err ${error ?? "?"})${sample.expectedPte != null ? `  PTE expected ${sample.expectedPte} → ${predictedPte ?? "null"} (err ${pteError ?? "?"})` : ""}`);
      console.log(`  measured: ${analysis.metrics.wpm} WPM, ${analysis.metrics.fillerWordCount} fillers, ${analysis.metrics.pauseFrequencyPerMinute} pauses/min  merged: ${JSON.stringify(merged.scores)}`);
    } catch (error) {
      dest.push(
        makeRow(commonRow(sample, null, null, null, null), {
          skillScores: {},
          mergedScores: { fluency: 0, grammar: 0, vocabulary: 0, coherence: 0, taskResponse: null },
        })
      );
      console.error(`${sample.name}: FAILED`, error instanceof Error ? error.message : error);
    }
  }
}

const speakingRow = (row: EvalRow, view: FeedbackView): EvalSummary["speaking"][number] => ({
  ...row,
  fluency: view.mergedScores?.fluency ?? 0,
  grammar: view.mergedScores?.grammar ?? 0,
  vocabulary: view.mergedScores?.vocabulary ?? 0,
  coherence: view.mergedScores?.coherence ?? 0,
  taskResponse: view.mergedScores?.taskResponse ?? null,
});

/**
 * Teacher-graded calibration: compares AI overall scores against real
 * teacher grades already in the database. Run with `--graded` and a
 * MONGO_URL. Only attempts with existing AI feedback are compared.
 */
async function runTeacherGraded(summary: EvalSummary) {
  console.log("\n--- Teacher-graded attempts (teacher % vs AI overall) ---");
  const attempts = await ExamAttempt.find({
    status: { $in: ["GRADED", "PUBLISHED"] },
    finalScore: { $ne: null },
    maxScore: { $gt: 0 },
    studentId: { $ne: null },
  })
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();
  const attemptIds = attempts.map((a) => a._id);
  const feedbackDocs = attemptIds.length
    ? await AIFeedback.find({ attemptId: { $in: attemptIds }, overallScore: { $ne: null } }).select("attemptId overallScore bands").lean()
    : [];
  const byAttempt = new Map<string, Array<typeof feedbackDocs[number]>>();
  for (const fb of feedbackDocs) {
    const key = String(fb.attemptId);
    const list = byAttempt.get(key) || [];
    list.push(fb);
    byAttempt.set(key, list);
  }
  let compared = 0;
  for (const attempt of attempts) {
    const list = byAttempt.get(String(attempt._id)) || [];
    const aggregate = list.find((f) => f.bands && (f.bands.ielts != null || f.bands.pte != null));
    const feedback = aggregate ?? list[list.length - 1];
    if (!feedback || attempt.maxScore == null) continue;
    const teacherPercent = Math.round(((attempt.finalScore ?? 0) / attempt.maxScore) * 100);
    const aiOverall = feedback.overallScore;
    if (typeof aiOverall !== "number") continue;
    const bandError = feedback.bands?.ielts != null
      ? Math.abs((teacherPercent / 100) * 9 - feedback.bands.ielts)
      : null;
    summary.graded.push({
      attemptId: String(attempt._id),
      teacherPercent,
      aiOverall,
      bandError,
      ielts: feedback.bands?.ielts ?? null,
      pte: feedback.bands?.pte ?? null,
    });
    compared += 1;
    console.log(`${String(attempt._id).slice(-6).padStart(6)} teacher ${teacherPercent}% → AI ${aiOverall}  (IELTS ${feedback.bands?.ielts ?? "null"}/${bandError?.toFixed(1) ?? "n/a"})`);
  }
  const bandErrors = summary.graded.map((g) => g.bandError).filter((e): e is number => e !== null);
  summary.gradedBandMae = bandErrors.length ? Math.round((bandErrors.reduce((a, b) => a + b, 0) / bandErrors.length) * 100) / 100 : null;
  console.log(`\nTeacher-graded samples compared: ${compared}; mean band error vs teacher: ${summary.gradedBandMae ?? "n/a"} band(s)`);
}

async function main() {
  if (!process.env.AI_API_KEY) {
    console.error("AI_API_KEY is not set — cannot run the evaluation.");
    process.exit(1);
  }

  const gradedOnly = process.argv.includes("--graded");
  const skipSynthetic = process.argv.includes("--golden-only");
  const summary: EvalSummary = {
    writing: [], speaking: [], syntheticWriting: [], syntheticSpeaking: [],
    graded: [], writingMae: null, speakingMae: null, gradedBandMae: null,
    syntheticWritingMae: null, syntheticSpeakingMae: null, ranAt: new Date().toISOString(),
  };
  console.log("=== AI IELTS/PTE calibration evaluation ===\n");

  if (!gradedOnly) {
    const goldenWritingRows: EvalSummary["writing"] = [];
    const goldenSpeakingRows: EvalSummary["speaking"] = [];
    const syntheticWritingRows: EvalSummary["syntheticWriting"] = [];
    const syntheticSpeakingRows: EvalSummary["syntheticSpeaking"] = [];
    await runLabeledSamples(
      EVAL_WRITING.map((s) => ({ name: s.name, prompt: s.prompt, essay: s.essay, expectedIelts: s.expectedIelts, expectedPte: s.expectedPte ?? null })),
      goldenWritingRows,
      (row, view) => ({ ...row, skillScores: view.skillScores }),
      "Golden"
    );
    await runLabeledSamples(
      EVAL_SPEAKING.map((s) => ({ name: s.name, prompt: s.prompt, transcript: s.transcript, durationSec: s.durationSec, expectedIelts: s.expectedIelts, expectedPte: s.expectedPte ?? null })),
      goldenSpeakingRows,
      speakingRow,
      "Golden"
    );
    if (!skipSynthetic) {
      await runLabeledSamples(
        SYNTHETIC_WRITING.map((s) => ({ name: s.name, prompt: s.prompt, essay: s.essay, expectedIelts: s.expectedIelts, expectedPte: s.expectedPte })),
        syntheticWritingRows,
        (row, view) => ({ ...row, skillScores: view.skillScores }),
        "Synthetic"
      );
      await runLabeledSamples(
        SYNTHETIC_SPEAKING.map((s) => ({ name: s.name, prompt: s.prompt, transcript: s.transcript, durationSec: s.durationSec, expectedIelts: s.expectedIelts, expectedPte: s.expectedPte })),
        syntheticSpeakingRows,
        speakingRow,
        "Synthetic"
      );
    }
    summary.writing.push(...goldenWritingRows);
    summary.speaking.push(...goldenSpeakingRows);
    summary.syntheticWriting.push(...syntheticWritingRows);
    summary.syntheticSpeaking.push(...syntheticSpeakingRows);
  }

  if (gradedOnly || process.argv.includes("--with-graded")) {
    if (!process.env.MONGO_URL) {
      console.error("MONGO_URL is not set — cannot compare teacher-graded attempts.");
      process.exit(1);
    }
    await mongoose.connect(process.env.MONGO_URL);
    await runTeacherGraded(summary);
    await mongoose.disconnect();
  }

  if (gradedOnly) {
    const reportDir = path.resolve(process.cwd(), "eval-reports");
    fs.mkdirSync(reportDir, { recursive: true });
    const reportPath = path.join(reportDir, `eval-graded-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
    console.log(`Report written to ${reportPath}`);
    process.exit(0);
  }

  summary.writingMae = maeOf(summary.writing.map((w) => w.error));
  summary.speakingMae = maeOf(summary.speaking.map((s) => s.error));
  summary.writingPteMae = maeOf(summary.writing.map((w) => w.pteError));
  summary.speakingPteMae = maeOf(summary.speaking.map((s) => s.pteError));
  summary.syntheticWritingMae = maeOf(summary.syntheticWriting.map((w) => w.error));
  summary.syntheticSpeakingMae = maeOf(summary.syntheticSpeaking.map((s) => s.error));
  summary.syntheticWritingPteMae = maeOf(summary.syntheticWriting.map((w) => w.pteError));
  summary.syntheticSpeakingPteMae = maeOf(summary.syntheticSpeaking.map((s) => s.pteError));
  console.log(`\nMean absolute error — writing: ${summary.writingMae ?? "n/a"} band(s)  speaking: ${summary.speakingMae ?? "n/a"} band(s)  writing PTE: ${summary.writingPteMae ?? "n/a"}  speaking PTE: ${summary.speakingPteMae ?? "n/a"}`);
  if (!skipSynthetic) {
    console.log(`Synthetic MAE — writing: ${summary.syntheticWritingMae ?? "n/a"} band(s)  speaking: ${summary.syntheticSpeakingMae ?? "n/a"} band(s)  writing PTE: ${summary.syntheticWritingPteMae ?? "n/a"}  speaking PTE: ${summary.syntheticSpeakingPteMae ?? "n/a"} (${summary.syntheticWriting.length + summary.syntheticSpeaking.length} samples)`);
  }

  const reportDir = path.resolve(process.cwd(), "eval-reports");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `eval-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.log(`Report written to ${reportPath}`);
}

main();
