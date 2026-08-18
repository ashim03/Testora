import { describe, expect, it } from "vitest";
import { EVAL_SPEAKING, EVAL_WRITING } from "./eval/ieltsDataset";
import { evaluateLanguage } from "../services/aiFeedbackService";

/**
 * Optional calibration gate: runs the labeled IELTS/PTE dataset through the
 * live AI provider and fails if a predicted band is more than one band away
 * from the expert label. Enable with RUN_AI_EVAL=1 (skipped by default so
 * CI stays hermetic). Requires AI_API_KEY to be set.
 */
const enabled = process.env.RUN_AI_EVAL === "1";

describe.runIf(enabled)("AI IELTS/PTE calibration (RUN_AI_EVAL=1)", () => {
  it("scores the writing samples within one band of the expert labels", async () => {
    for (const sample of EVAL_WRITING) {
      const feedback = await evaluateLanguage("WRITING", sample.essay, sample.prompt);
      expect(feedback.bands?.ielts, sample.name).not.toBeNull();
      const predicted = feedback.bands?.ielts ?? 0;
      expect(Math.abs(predicted - sample.expectedIelts), `${sample.name}: expected ${sample.expectedIelts}, got ${predicted}`).toBeLessThanOrEqual(1);
    }
  }, 240000);

  it("scores the speaking samples within one band of the expert labels", async () => {
    for (const sample of EVAL_SPEAKING) {
      const feedback = await evaluateLanguage("SPEAKING", sample.transcript, sample.prompt, {
        words: 120,
        wpm: 120,
        fillerWordCount: 0,
        pauseFrequencyPerMinute: 3,
      });
      expect(feedback.bands?.ielts, sample.name).not.toBeNull();
      const predicted = feedback.bands?.ielts ?? 0;
      expect(Math.abs(predicted - sample.expectedIelts), `${sample.name}: expected ${sample.expectedIelts}, got ${predicted}`).toBeLessThanOrEqual(1);
    }
  }, 240000);
});