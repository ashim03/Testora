import "dotenv/config";
import fs from "fs";
import path from "path";
import { EVAL_SPEAKING, EVAL_WRITING, type EvalSummary } from "../tests/eval/ieltsDataset";
import { evaluateLanguage } from "../services/aiFeedbackService";
import { analyzeTranscript, mergeSpeakingScores } from "../services/speakingAnalysisService";

const absError = (expected: number, predicted: number | null | undefined) =>
  typeof predicted === "number" ? Math.abs(expected - predicted) : null;

async function main() {
  if (!process.env.AI_API_KEY) {
    console.error("AI_API_KEY is not set — cannot run the evaluation.");
    process.exit(1);
  }

  const summary: EvalSummary = { writing: [], speaking: [], writingMae: null, speakingMae: null, ranAt: new Date().toISOString() };
  console.log("=== AI IELTS/PTE calibration evaluation ===\n");

  console.log("--- Writing (expected IELTS band vs predicted) ---");
  for (const sample of EVAL_WRITING) {
    try {
      const feedback = await evaluateLanguage("WRITING", sample.essay, sample.prompt);
      const predicted = feedback.bands?.ielts ?? null;
      const error = absError(sample.expectedIelts, predicted);
      summary.writing.push({ name: sample.name, expected: sample.expectedIelts, predicted, error, skillScores: feedback.skillScores });
      console.log(`${sample.name.padEnd(16)} expected ${sample.expectedIelts} → predicted ${predicted ?? "null"}  (err ${error ?? "?"})  scores ${JSON.stringify(feedback.skillScores)}`);
    } catch (error) {
      summary.writing.push({ name: sample.name, expected: sample.expectedIelts, predicted: null, error: null, skillScores: {} });
      console.error(`${sample.name}: FAILED`, error instanceof Error ? error.message : error);
    }
  }

  console.log("\n--- Speaking (expected IELTS band vs predicted, fluency measured) ---");
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
      const error = absError(sample.expectedIelts, predicted);
      summary.speaking.push({
        name: sample.name,
        expected: sample.expectedIelts,
        predicted,
        error,
        fluency: merged.scores.fluency,
        grammar: merged.scores.grammar,
        vocabulary: merged.scores.vocabulary,
        coherence: merged.scores.coherence,
        taskResponse: merged.scores.taskResponse ?? null,
      });
      console.log(`${sample.name.padEnd(16)} expected ${sample.expectedIelts} → predicted ${predicted ?? "null"}  (err ${error ?? "?"})`);
      console.log(`  measured: ${analysis.metrics.wpm} WPM, ${analysis.metrics.fillerWordCount} fillers, ${analysis.metrics.pauseFrequencyPerMinute} pauses/min  merged: ${JSON.stringify(merged.scores)}`);
    } catch (error) {
      summary.speaking.push({ name: sample.name, expected: sample.expectedIelts, predicted: null, error: null, fluency: 0, grammar: 0, vocabulary: 0, coherence: 0, taskResponse: null });
      console.error(`${sample.name}: FAILED`, error instanceof Error ? error.message : error);
    }
  }

  const writingErrors = summary.writing.map((w) => w.error).filter((e): e is number => e !== null);
  const speakingErrors = summary.speaking.map((s) => s.error).filter((e): e is number => e !== null);
  summary.writingMae = writingErrors.length ? Math.round((writingErrors.reduce((a, b) => a + b, 0) / writingErrors.length) * 100) / 100 : null;
  summary.speakingMae = speakingErrors.length ? Math.round((speakingErrors.reduce((a, b) => a + b, 0) / speakingErrors.length) * 100) / 100 : null;
  console.log(`\nMean absolute error — writing: ${summary.writingMae ?? "n/a"} band(s), speaking: ${summary.speakingMae ?? "n/a"} band(s)`);

  const reportDir = path.resolve(process.cwd(), "eval-reports");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `eval-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.log(`Report written to ${reportPath}`);
}

main();