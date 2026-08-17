import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateLanguage, parseJson } from "../services/aiFeedbackService";
import { ApiError } from "../utils/helpers";

const submission = "I am go to school every day and I seen my frends there.";

describe("parseJson", () => {
  it("parses a valid response and clamps scores to 0-100", () => {
    const raw = { overallScore: 87, skillScores: { grammar: 60, vocabulary: 40, coherence: 120 }, strengths: ["clear ideas"], improvements: [], grammar: [], vocabulary: [], coherence: [], fluency: [], pronunciation: [], nextSteps: [], disclaimer: "" };
    const result = parseJson(JSON.stringify(raw), submission.length);
    expect(result.overallScore).toBe(87);
    expect(result.skillScores).toEqual({ grammar: 60, vocabulary: 40, coherence: 100 });
  });

  it("rejects responses without the required shape", () => {
    expect(() => parseJson(JSON.stringify({ overallScore: "nope" }), submission.length)).toThrow(ApiError);
    expect(() => parseJson("not json", submission.length)).toThrow(ApiError);
  });

  it("strips markdown fences", () => {
    const raw = { overallScore: 50, skillScores: { grammar: 50 }, strengths: [], improvements: [], grammar: [], vocabulary: [], coherence: [], fluency: [], pronunciation: [], nextSteps: [], disclaimer: "" };
    const result = parseJson("```json\n" + JSON.stringify(raw) + "\n```", submission.length);
    expect(result.overallScore).toBe(50);
  });

  describe("bands", () => {
    it("clamps ielts to 0-9 and pte to 0-90", () => {
      const raw = { overallScore: 50, skillScores: {}, strengths: [], improvements: [], bands: { ielts: 12, pte: 95 }, disclaimer: "" };
      const result = parseJson(JSON.stringify(raw), submission.length);
      expect(result.bands).toEqual({ ielts: 9, pte: 90 });
    });
    it("normalizes missing band values to null", () => {
      const raw = { overallScore: 50, skillScores: {}, strengths: [], improvements: [], bands: { ielts: null }, disclaimer: "" };
      const result = parseJson(JSON.stringify(raw), submission.length);
      expect(result.bands).toEqual({ ielts: null, pte: null });
    });
    it("drops malformed bands", () => {
      const raw = { overallScore: 50, skillScores: {}, strengths: [], improvements: [], bands: "7.5", disclaimer: "" };
      expect(parseJson(JSON.stringify(raw), submission.length).bands).toBeNull();
    });
  });

  describe("annotations", () => {
    it("clamps offsets to the submission length and rounds them", () => {
      const raw = { overallScore: 50, skillScores: {}, strengths: [], improvements: [], annotations: [{ start: -5, end: 9999, original: "go", correction: "going", category: "grammar", note: "", severity: "high" }], disclaimer: "" };
      const result = parseJson(JSON.stringify(raw), submission.length);
      expect(result.annotations).toEqual([{ start: 0, end: submission.length, original: "go", correction: "going", category: "grammar", note: "", severity: "high" }]);
    });
    it("falls back to medium severity for unknown values", () => {
      const raw = { overallScore: 50, skillScores: {}, strengths: [], improvements: [], annotations: [{ start: 0, end: 2, original: "go", correction: "going", category: "grammar", note: "", severity: "critical" }], disclaimer: "" };
      expect(parseJson(JSON.stringify(raw), submission.length).annotations[0].severity).toBe("medium");
    });
    it("drops malformed annotations", () => {
      const raw = { overallScore: 50, skillScores: {}, strengths: [], improvements: [], annotations: [{ start: "x", end: 2, original: "go", correction: "going" }, { start: 0, end: 2, original: "go", correction: "going", category: "grammar", note: "", severity: "low" }], disclaimer: "" };
      const result = parseJson(JSON.stringify(raw), submission.length);
      expect(result.annotations).toHaveLength(1);
    });
    it("caps annotations at 50", () => {
      const annotations = Array.from({ length: 60 }, (_, i) => ({ start: i, end: i + 1, original: "x", correction: "y", category: "grammar", note: "", severity: "low" }));
      const raw = { overallScore: 50, skillScores: {}, strengths: [], improvements: [], annotations, disclaimer: "" };
      expect(parseJson(JSON.stringify(raw), submission.length).annotations).toHaveLength(50);
    });
  });

  describe("modelAnswer and advice", () => {
    it("trims and keeps non-empty values", () => {
      const raw = { overallScore: 50, skillScores: {}, strengths: [], improvements: [], modelAnswer: "  A strong answer.  ", advice: "  Practice daily.  ", disclaimer: "" };
      const result = parseJson(JSON.stringify(raw), submission.length);
      expect(result.modelAnswer).toBe("A strong answer.");
      expect(result.advice).toBe("Practice daily.");
    });
    it("turns empty values into null", () => {
      const raw = { overallScore: 50, skillScores: {}, strengths: [], improvements: [], modelAnswer: "   ", advice: "", disclaimer: "" };
      const result = parseJson(JSON.stringify(raw), submission.length);
      expect(result.modelAnswer).toBeNull();
      expect(result.advice).toBeNull();
    });
  });
});

describe("evaluateLanguage", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("extracts output text from the provider response", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    const payload = { overallScore: 72, skillScores: { grammar: 70 }, strengths: ["a"], improvements: [], grammar: [], vocabulary: [], coherence: [], fluency: [], pronunciation: [], nextSteps: [], disclaimer: "" };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(payload) }] }] }) });
    vi.stubGlobal("fetch", fetchMock);
    const result = await evaluateLanguage("WRITING", "This is a sufficiently long writing sample for evaluation purposes.");
    expect(result.overallScore).toBe(72);
    expect(result.disclaimer).toBeTruthy();
  });

  it("throws ApiError on a non-JSON provider response", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ output: [{ type: "message", content: [{ type: "output_text", text: "sorry, no json" }] }] }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(evaluateLanguage("WRITING", "This is a sufficiently long writing sample for evaluation purposes.")).rejects.toThrow(ApiError);
  });

  it("rejects short input before calling the provider", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(evaluateLanguage("WRITING", "too short")).rejects.toThrow(ApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});