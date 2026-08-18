import { describe, expect, it } from "vitest";
import { applyWritingTaskResponse, OFF_TOPIC_THRESHOLD } from "../services/aiFeedbackService";
import type { AiFeedback } from "../services/aiFeedbackService";

const base = (skillScores: Record<string, number>, bands: { ielts: number | null; pte: number | null } | null = null): AiFeedback => ({
  overallScore: 80,
  skillScores: { grammar: 80, vocabulary: 80, coherence: 80, fluency: 80, ...skillScores },
  strengths: [],
  improvements: [],
  grammar: [],
  vocabulary: [],
  coherence: [],
  fluency: [],
  pronunciation: [],
  nextSteps: [],
  disclaimer: "",
  bands,
});

describe("applyWritingTaskResponse", () => {
  it("recomputes the overall score from the four writing criteria", () => {
    const feedback = base({ grammar: 80, vocabulary: 80, coherence: 80, taskResponse: 60 });
    const { feedback: updated } = applyWritingTaskResponse(feedback, true);
    expect(updated.overallScore).toBe(75);
    expect(updated.overallScore).not.toBe(feedback.overallScore);
  });

  it("flags off-topic responses and caps the bands regardless of language quality", () => {
    const feedback = base({ grammar: 90, vocabulary: 90, coherence: 90, taskResponse: 25 }, { ielts: 8, pte: 80 });
    const { offTopic, taskResponseNote, feedback: updated } = applyWritingTaskResponse(feedback, true);
    expect(offTopic).toBe(true);
    expect(taskResponseNote).toMatch(/off topic/i);
    expect(updated.bands?.ielts).toBe(2.5); // 25/100 * 9 = 2.25 → nearest half band = 2.5
    expect(updated.bands?.pte).toBe(23); // 25 * 0.9 = 22.5 → 23
    expect(updated.overallScore).toBe(74);
  });

  it("does not touch the response when no prompt is provided", () => {
    const feedback = base({ taskResponse: 10 }, { ielts: 8, pte: 80 });
    const result = applyWritingTaskResponse(feedback, false);
    expect(result.offTopic).toBe(false);
    expect(result.taskResponseNote).toBeNull();
    expect(result.feedback).toEqual(feedback);
  });

  it("does not flag responses with an acceptable task response", () => {
    const feedback = base({ taskResponse: OFF_TOPIC_THRESHOLD + 10 }, { ielts: 8, pte: 80 });
    const { offTopic, feedback: updated } = applyWritingTaskResponse(feedback, true);
    expect(offTopic).toBe(false);
    expect(updated.bands?.ielts).toBe(8);
  });

  it("skips the recomputation when the model omitted task response", () => {
    const feedback = base({ grammar: 70, vocabulary: 70, coherence: 70 });
    const { offTopic, feedback: updated } = applyWritingTaskResponse(feedback, true);
    expect(offTopic).toBe(false);
    expect(updated.overallScore).toBe(80);
  });

  it("keeps the AI band when task response is strong", () => {
    const feedback = base({ grammar: 85, vocabulary: 80, coherence: 85, taskResponse: 82 }, { ielts: 8, pte: 79 });
    const { feedback: updated } = applyWritingTaskResponse(feedback, true);
    expect(updated.bands).toEqual({ ielts: 8, pte: 79 });
  });
});
