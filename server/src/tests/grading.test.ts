import { describe, it, expect } from "vitest";
import {
  normalizeAnswer,
  isCorrectAnswer,
  scoreAnswer,
  isObjectiveQuestionType,
} from "../services/gradingService";

describe("grading helpers", () => {
  describe("normalizeAnswer", () => {
    it("trims surrounding whitespace and lowercases", () => {
      expect(normalizeAnswer("  The Cat  ")).toBe("the cat");
    });
    it("joins array answers with a delimiter after sorting", () => {
      expect(normalizeAnswer([" B", "a"])).toBe("a|b");
    });
  });

  describe("isCorrectAnswer", () => {
    it("matches a single-choice key", () => {
      const q = { type: "SINGLE_CHOICE", correctAnswers: ["b"] };
      expect(isCorrectAnswer(q, "b")).toBe(true);
      expect(isCorrectAnswer(q, "c")).toBe(false);
    });
    it("accepts acceptedAnswers for free-text", () => {
      const q = { type: "SHORT_ANSWER", correctAnswers: [], acceptedAnswers: ["ielts", "pte"] };
      expect(isCorrectAnswer(q, "IELTS")).toBe(true);
      expect(isCorrectAnswer(q, "toefl")).toBe(false);
    });
    it("rejects empty answers", () => {
      const q = { type: "SINGLE_CHOICE", correctAnswers: ["a"] };
      expect(isCorrectAnswer(q, "")).toBe(false);
      expect(isCorrectAnswer(q, [])).toBe(false);
    });
  });

  describe("scoreAnswer", () => {
    it("awards full marks for correct answers", () => {
      const q = { type: "SINGLE_CHOICE", correctAnswers: ["a"], acceptedAnswers: [], marks: 2, negativeMarks: 0 };
      expect(scoreAnswer(q, "a")).toEqual({ earned: 2, isCorrect: true });
    });
    it("earns 0 for incorrect", () => {
      const q = { type: "SINGLE_CHOICE", correctAnswers: ["a"], acceptedAnswers: [], marks: 2, negativeMarks: 0 };
      const result = scoreAnswer(q, "b");
      expect(result.isCorrect).toBe(false);
      expect(result.earned === 0).toBe(true);
    });
    it("applies negative marking for an incorrect attempt", () => {
      const q = { type: "SINGLE_CHOICE", correctAnswers: ["a"], acceptedAnswers: [], marks: 2, negativeMarks: 1 };
      expect(scoreAnswer(q, "b").earned).toBe(-1);
    });
  });

  describe("isObjectiveQuestionType", () => {
    it("flags choice and blank questions as objective", () => {
      expect(isObjectiveQuestionType("SINGLE_CHOICE")).toBe(true);
      expect(isObjectiveQuestionType("FILL_BLANK")).toBe(true);
      expect(isObjectiveQuestionType("ESSAY")).toBe(false);
      expect(isObjectiveQuestionType("READ_ALOUD")).toBe(false);
    });
  });
});