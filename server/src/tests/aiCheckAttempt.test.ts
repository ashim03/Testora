import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkAttemptWithAI } from "../services/aiFeedbackService";
import { ApiError } from "../utils/helpers";

const attemptId = "64abc0000000000000000001";
const examId = "64abc0000000000000000002";
const q1 = "64abc0000000000000000003";
const q2 = "64abc0000000000000000004";

const essay = "This essay discusses the advantages of public transport and argues that it should be expanded. ";
const essayLong = essay.repeat(2);

vi.mock("../models", () => ({
  AIFeedback: { find: vi.fn(), create: vi.fn() },
  ExamAnswer: { find: vi.fn() },
  ExamAttempt: { findOne: vi.fn() },
  Exam: { findById: vi.fn() },
  Question: { find: vi.fn() },
  LearningProfile: { findOneAndUpdate: vi.fn() },
}));

import { AIFeedback, ExamAnswer, ExamAttempt, Exam, Question, LearningProfile } from "../models";

function chainLean(result: unknown) {
  return { select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(result) }) };
}

function chainLeanDirect(result: unknown) {
  return { lean: vi.fn().mockResolvedValue(result) };
}

function answered(qid: string, text: string) {
  return { attemptId, examId, studentId: "64abc0000000000000000005", questionId: qid, answer: text, answered: true };
}

function setupModels({ status = "UNDER_REVIEW", answers, questions, existing = [] }: { status?: string; answers: Array<Record<string, unknown>>; questions: Array<Record<string, unknown>>; existing?: Array<Record<string, unknown>> }) {
  vi.mocked(ExamAttempt.findOne).mockResolvedValue({ _id: attemptId, examId, status } as never);
  vi.mocked(Exam.findById).mockReturnValue(chainLean({ title: "IELTS Writing Under Review", sections: [{ questionIds: [q1, q2] }], questionIds: [] }) as never);
  vi.mocked(ExamAnswer.find).mockReturnValue(chainLeanDirect(answers) as never);
  vi.mocked(Question.find).mockReturnValue(chainLean(questions) as never);
  vi.mocked(AIFeedback.find).mockReturnValue(chainLean(existing) as never);
}

const baseFeedback = { _id: "fb-1", createdAt: new Date("2026-01-01T00:00:00Z"), overallScore: 70, skillScores: {}, bands: null, annotations: [], modelAnswer: null, advice: null, strengths: [], improvements: [], grammar: [], vocabulary: [], coherence: [], fluency: [], pronunciation: [], nextSteps: [], disclaimer: "", providerModel: "qwen-plus", prompt: null, submission: essayLong };

const aiPayload = { overallScore: 70, skillScores: { grammar: 70, vocabulary: 70, coherence: 70, fluency: 70 }, strengths: ["clear structure"], improvements: [], grammar: [], vocabulary: [], coherence: [], fluency: [], pronunciation: [], nextSteps: [], disclaimer: "" };

describe("checkAttemptWithAI", () => {
  beforeEach(() => {
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(aiPayload) }] }] }) }));
    vi.mocked(AIFeedback.create).mockResolvedValue({ _id: "fb-new", createdAt: new Date() } as never);
    vi.mocked(LearningProfile.findOneAndUpdate).mockResolvedValue({ skills: new Map(), totalPracticeSessions: 0, lastPracticeAt: null, save: vi.fn().mockResolvedValue(undefined) } as never);
  });

  afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });

  it("generates feedback for each essay question and persists it with question context", async () => {
    setupModels({
      answers: [answered(q1, essayLong), answered(q2, essayLong)],
      questions: [
        { _id: q1, type: "ESSAY", title: "Task 1", instructions: "Write about transport.", minWordLimit: null, maxWordLimit: 250 },
        { _id: q2, type: "LETTER", title: "Task 2", instructions: "Write a letter.", minWordLimit: null, maxWordLimit: null },
      ],
    });
    const result = await checkAttemptWithAI("stu-1", attemptId);
    expect(result.questions).toHaveLength(2);
    expect(result.questions.every((q) => q.feedback && q.reused === false)).toBe(true);
    expect(AIFeedback.create).toHaveBeenCalledTimes(2);
    expect(AIFeedback.create).toHaveBeenCalledWith(expect.objectContaining({ attemptId, examId, questionId: q1, type: "WRITING" }));
    expect(result.questions[0].prompt).toContain("Word limit: maximum 250");
  });

  it("reuses previously generated feedback instead of calling the provider again", async () => {
    setupModels({
      answers: [answered(q1, essayLong), answered(q2, essayLong)],
      questions: [
        { _id: q1, type: "ESSAY", title: "Task 1", instructions: "", minWordLimit: null, maxWordLimit: null },
        { _id: q2, type: "ESSAY", title: "Task 2", instructions: "", minWordLimit: null, maxWordLimit: null },
      ],
      existing: [{ ...baseFeedback, questionId: q1, submission: essayLong }],
    });
    const result = await checkAttemptWithAI("stu-1", attemptId);
    const first = result.questions.find((q) => q.questionId === q1);
    const second = result.questions.find((q) => q.questionId === q2);
    expect(first?.reused).toBe(true);
    expect(second?.reused).toBe(false);
    expect(AIFeedback.create).toHaveBeenCalledTimes(1);
  });

  it("skips short, non-string, and non-writing answers", async () => {
    setupModels({
      answers: [answered(q1, "hi"), { ...answered(q2, essayLong), answer: { text: "nested" } }, answered("64abc0000000000000000006", essayLong)],
      questions: [
        { _id: q1, type: "ESSAY", title: "Short", instructions: "", minWordLimit: null, maxWordLimit: null },
        { _id: q2, type: "ESSAY", title: "Nested", instructions: "", minWordLimit: null, maxWordLimit: null },
        { _id: "64abc0000000000000000006", type: "SINGLE_CHOICE", title: "MCQ", instructions: "", minWordLimit: null, maxWordLimit: null },
      ],
    });
    const result = await checkAttemptWithAI("stu-1", attemptId);
    expect(result.questions).toHaveLength(0);
    expect(AIFeedback.create).not.toHaveBeenCalled();
  });

  it("collects per-question provider failures without failing the whole check", async () => {
    setupModels({
      answers: [answered(q1, essayLong), answered(q2, essayLong)],
      questions: [
        { _id: q1, type: "ESSAY", title: "Task 1", instructions: "", minWordLimit: null, maxWordLimit: null },
        { _id: q2, type: "ESSAY", title: "Task 2", instructions: "", minWordLimit: null, maxWordLimit: null },
      ],
    });
    vi.mocked(AIFeedback.create).mockRejectedValueOnce(new ApiError(502, "AI feedback service is temporarily unavailable"));
    const result = await checkAttemptWithAI("stu-1", attemptId);
    const first = result.questions.find((q) => q.questionId === q1);
    const second = result.questions.find((q) => q.questionId === q2);
    expect(first?.error).toBe("AI feedback service is temporarily unavailable");
    expect(second?.feedback).not.toBeNull();
  });

  it("throws when every question fails", async () => {
    setupModels({
      answers: [answered(q1, essayLong)],
      questions: [{ _id: q1, type: "ESSAY", title: "Task 1", instructions: "", minWordLimit: null, maxWordLimit: null }],
    });
    vi.mocked(AIFeedback.create).mockRejectedValue(new ApiError(502, "boom"));
    await expect(checkAttemptWithAI("stu-1", attemptId)).rejects.toThrow(ApiError);
  });

  it("rejects attempts that have not been submitted", async () => {
    vi.mocked(ExamAttempt.findOne).mockResolvedValue({ _id: attemptId, examId, status: "IN_PROGRESS" } as never);
    await expect(checkAttemptWithAI("stu-1", attemptId)).rejects.toThrow(/Submit the attempt/);
    expect(ExamAnswer.find).not.toHaveBeenCalled();
  });

  it("returns 404 for an attempt owned by someone else", async () => {
    vi.mocked(ExamAttempt.findOne).mockResolvedValue(null as never);
    await expect(checkAttemptWithAI("stu-1", attemptId)).rejects.toThrow(ApiError);
    expect(ExamAnswer.find).not.toHaveBeenCalled();
  });
});
