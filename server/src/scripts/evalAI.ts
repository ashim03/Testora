import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { EVAL_SPEAKING, EVAL_WRITING, type EvalSummary } from "../tests/eval/ieltsDataset";
import { applyWritingTaskResponse, evaluateLanguage } from "../services/aiFeedbackService";
import { analyzeTranscript, mergeSpeakingScores } from "../services/speakingAnalysisService";
import { AIFeedback } from "../models/AIFeedback";
import { ExamAttempt } from "../models/ExamAttempt";
import { Exam } from "../models/Exam";

const absError = (expected: number, predicted: number | null | undefined) =>
  typeof predicted === "number" ? Math.abs(expected - predicted) : null;

async function runLabeledSamples(summary: EvalSummary) {
  console.log("--- Writing (expected band vs predicted) ---");
  for (const sample of EVAL_WRITING) {
    try {
      let feedback = await evaluateLanguage("WRITING", sample.essay, sample.prompt);
      const applied = applyWritingTaskResponse(feedback, sample.prompt);
      feedback = applied.feedback;
      const predicted = feedback.bands?.ielts ?? null;
      const predictedPte = feedback.bands?.pte ?? null;
      const error = absError(sample.expectedIelts, predicted);
      const pteError = sample.expectedPte != null ? absError(sample.expectedPte, predictedPte) : null;
      summary.writing.push({ name: sample.name, expected: sample.expectedIelts, predicted, error, expectedPte: sample.expectedPte ?? null, predictedPte, pteError, skillScores: feedback.skillScores });
      console.log(`${sample.name.padEnd(16)} expected ${sample.expectedIelts} → predicted ${predicted ?? "null"}  (err ${error ?? "?"})${sample.expectedPte != null ? `  PTE expected ${sample.expectedPte} → ${predictedPte ?? "null"} (err ${pteError ?? "?"})` : ""}  scores ${JSON.stringify(feedback.skillScores)}`);
    } catch (error) {
      summary.writing.push({ name: sample.name, expected: sample.expectedIelts, predicted: null, error: null, expectedPte: sample.expectedPte ?? null, predictedPte: null, pteError: null, skillScores: {} });
      console.error(`${sample.name}: FAILED`, error instanceof Error ? error.message : error);
    }
  }

  console.log("\n--- Speaking (expected band vs predicted, fluency measured) ---");
  for (const sample of EVAL_SPEAKING) {
    try {
      const analysis = analyzeTranscript({ text: sample.transcript, durationSec: sample.durationSec });
      const ai = await evaluateLanguage("SPEAKING", sample.transcript, sample.prompt, {
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
      summary.speaking.push({
        name: sample.name,
        expected: sample.expectedIelts,
        predicted,
        error,
        expectedPte: sample.expectedPte ?? null,
        predictedPte,
        pteError,
        fluency: merged.scores.fluency,
        grammar: merged.scores.grammar,
        vocabulary: merged.scores.vocabulary,
        coherence: merged.scores.coherence,
        taskResponse: merged.scores.taskResponse ?? null,
      });
      console.log(`${sample.name.padEnd(16)} expected ${sample.expectedIelts} → predicted ${predicted ?? "null"}  (err ${error ?? "?"})${sample.expectedPte != null ? `  PTE expected ${sample.expectedPte} → ${predictedPte ?? "null"} (err ${pteError ?? "?"})` : ""}`);
      console.log(`  measured: ${analysis.metrics.wpm} WPM, ${analysis.metrics.fillerWordCount} fillers, ${analysis.metrics.pauseFrequencyPerMinute} pauses/min  merged: ${JSON.stringify(merged.scores)}`);
    } catch (error) {
      summary.speaking.push({ name: sample.name, expected: sample.expectedIelts, predicted: null, error: null, expectedPte: sample.expectedPte ?? null, predictedPte: null, pteError: null, fluency: 0, grammar: 0, vocabulary: 0, coherence: 0, taskResponse: null });
      console.error(`${sample.name}: FAILED`, error instanceof Error ? error.message : error);
    }
  }
}

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
  const summary: EvalSummary = { writing: [], speaking: [], graded: [], writingMae: null, speakingMae: null, gradedBandMae: null, ranAt: new Date().toISOString() };
  console.log("=== AI IELTS/PTE calibration evaluation ===\n");

  if (!gradedOnly) {
    await runLabeledSamples(summary);
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

  const writingErrors = summary.writing.map((w) => w.error).filter((e): e is number => e !== null);
  const speakingErrors = summary.speaking.map((s) => s.error).filter((e): e is number => e !== null);
  const writingPteErrors = summary.writing.map((w) => w.pteError).filter((e): e is number => e !== null);
  const speakingPteErrors = summary.speaking.map((s) => s.pteError).filter((e): e is number => e !== null);
  summary.writingMae = writingErrors.length ? Math.round((writingErrors.reduce((a, b) => a + b, 0) / writingErrors.length) * 100) / 100 : null;
  summary.speakingMae = speakingErrors.length ? Math.round((speakingErrors.reduce((a, b) => a + b, 0) / speakingErrors.length) * 100) / 100 : null;
  summary.writingPteMae = writingPteErrors.length ? Math.round((writingPteErrors.reduce((a, b) => a + b, 0) / writingPteErrors.length) * 100) / 100 : null;
  summary.speakingPteMae = speakingPteErrors.length ? Math.round((speakingPteErrors.reduce((a, b) => a + b, 0) / speakingPteErrors.length) * 100) / 100 : null;
  console.log(`\nMean absolute error — writing: ${summary.writingMae ?? "n/a"} band(s)  speaking: ${summary.speakingMae ?? "n/a"} band(s)  writing PTE: ${summary.writingPteMae ?? "n/a"}  speaking PTE: ${summary.speakingPteMae ?? "n/a"}`);

  const reportDir = path.resolve(process.cwd(), "eval-reports");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `eval-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.log(`Report written to ${reportPath}`);
}

main();
