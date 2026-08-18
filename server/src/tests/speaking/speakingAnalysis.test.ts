import { describe, it, expect } from "vitest";
import {
  analyzeTranscript,
  countFillerWords,
  detectRepeatedPhrases,
  mergeSpeakingScores,
  splitSentences,
  tokenizeWords,
} from "../../services/speakingAnalysisService";

const SAMPLE = `I think staying healthy is important for everyone. Um, first of all I like to exercise in the morning because it gives me energy. Um, and I mean, when I exercise I feel better during the whole day. Actually, my favorite activity is running, and I usually run for about thirty minutes every day. For example, last week I ran five times and um I felt really productive. However, sometimes I struggle to keep the habit, you know, but I try my best every day. Overall, I believe small habits make a big difference in the long term.`;

const ANALYSIS = analyzeTranscript({ text: SAMPLE, durationSec: 60 });

describe("tokenizeWords / splitSentences", () => {
  it("splits words and discards punctuation", () => {
    const words = tokenizeWords("Hello, world! Wouldn't you?");
    expect(words).toEqual(["hello", "world", "wouldn't", "you"]);
  });
  it("lowercases", () => {
    expect(tokenizeWords("HeLLo")).toEqual(["hello"]);
  });
  it("splits sentences on terminal punctuation", () => {
    expect(splitSentences("One. Two! Three?")).toHaveLength(3);
    expect(splitSentences("No trailing punctuation here")).toHaveLength(1);
  });
});

describe("countFillerWords", () => {
  it("counts and ranks filler words", () => {
    const { count, items } = countFillerWords(tokenizeWords("um um like like like actually well"));
    expect(count).toBe(7);
    expect(items[0]).toBe("like (×3)");
    expect(items[1]).toBe("um (×2)");
  });
  it("returns empty when clean", () => {
    expect(countFillerWords(tokenizeWords("this is a clean sentence"))).toEqual({ count: 0, items: [] });
  });
});

describe("detectRepeatedPhrases", () => {
  it("finds verbatim repeated bigrams", () => {
    const { count, phrases } = detectRepeatedPhrases(tokenizeWords("the same the same the same story the same the same the same way"));
    expect(count).toBeGreaterThan(0);
    expect(phrases.some((p) => p.startsWith("the same"))).toBe(true);
  });
  it("ignores repeated phrases below the noise threshold", () => {
    const { count } = detectRepeatedPhrases(tokenizeWords("a b a b c d e f g h i j k l m n o p q r s"));
    expect(count).toBe(0);
  });
});

describe("analyzeTranscript", () => {
  it("computes WPM from word count and duration", () => {
    const { metrics } = analyzeTranscript({ text: SAMPLE, durationSec: 60 });
    expect(metrics.wpm).toBe(metrics.words);
  });
  it("produces a coherent metrics object", () => {
    const result = analyzeTranscript({ text: SAMPLE, durationSec: 60 });
    const { metrics, scores, estimate, qualitative } = result;
    expect(estimate).toBe(true);
    expect(metrics.words).toBeGreaterThan(50);
    expect(metrics.sentences).toBeGreaterThan(3);
    expect(metrics.fillerWordCount).toBeGreaterThanOrEqual(5); // Um, I mean, Actually, um, you know
    expect(metrics.fillerWords.length).toBeGreaterThan(0);
    expect(metrics.durationSec).toBe(60);
    expect(metrics.wpm).toBeGreaterThan(0);
    expect(metrics.pauseFrequencyPerMinute).toBeGreaterThanOrEqual(0);
    expect(metrics.avgWordsPerSentence).toBeGreaterThan(5);
    expect(["short", "medium", "complex"]).toContain(metrics.sentenceComplexity);
    expect(metrics.typeTokenRatio).toBeGreaterThan(0.4);
    // qualitative feedback accompanies every analysis
    expect(qualitative.strengths.length).toBeGreaterThanOrEqual(1);
    expect(qualitative.recommendations.length).toBeGreaterThanOrEqual(1);
    // scores stay in range and overall is a weighted blend
    for (const value of Object.values(scores)) {
      if (typeof value !== "number") continue; // taskResponse is null for heuristic estimates
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });
  it("estimates pauses from silent time rather than claiming measured pauses", () => {
    // 100 words ≈ 40 s of speech at 150 wpm; 60 s recording → ~16 modeled pauses.
    const { metrics } = analyzeTranscript({ text: SAMPLE, durationSec: 60 });
    expect(metrics.pauseCount).toBeGreaterThan(0);
    expect(metrics.pauseCount).toBeLessThanOrEqual(Math.round((60 - metrics.words / 2.5) / 1.25));
  });
  it("flags empty transcripts", () => {
    const { qualitative } = analyzeTranscript({ text: "", durationSec: 10 });
    expect(qualitative.weaknesses[0]).toMatch(/no intelligible speech/i);
  });
  it("penalizes heavy filler usage in the fluency score", () => {
    const clean = analyzeTranscript({ text: SAMPLE, durationSec: 60 });
    const dirty = analyzeTranscript({ text: SAMPLE + " um um um um um um um um um um um um um um um um", durationSec: 60 });
    expect(dirty.scores.fluency).toBeLessThan(clean.scores.fluency);
  });
});

describe("mergeSpeakingScores", () => {
  const ai = (skillScores: Record<string, number | null | undefined>, overallScore = 80) => ({ overallScore, skillScores });

  it("keeps the heuristic scores untouched when no AI feedback exists", () => {
    const result = mergeSpeakingScores(ANALYSIS, null, true);
    expect(result.scores).toEqual({ ...ANALYSIS.scores, taskResponse: null });
    expect(result.offTopic).toBe(false);
    expect(result.taskResponseNote).toBeNull();
  });

  it("weights task response highest, so fluent but off-topic answers cannot score high", () => {
    // Fluent in every dimension but the answer is irrelevant to the task.
    const result = mergeSpeakingScores(ANALYSIS, ai({ fluency: 95, grammar: 90, vocabulary: 90, coherence: 85, taskResponse: 20 }), true);
    expect(result.scores.taskResponse).toBe(20);
    // Fluency is measured from delivery metrics, not guessed by the AI from text.
    expect(result.scores.fluency).toBe(ANALYSIS.scores.fluency);
    // 20*0.25 + fluency*0.25 + 90*0.2 + 90*0.2 + 85*0.1
    expect(result.scores.overall).toBe(Math.round(5 + ANALYSIS.scores.fluency * 0.25 + 18 + 18 + 8.5));
    expect(result.offTopic).toBe(true);
    expect(result.taskResponseNote).toMatch(/off topic/i);
  });

  it("does not flag borderline task responses", () => {
    const result = mergeSpeakingScores(ANALYSIS, ai({ fluency: 80, grammar: 80, vocabulary: 80, coherence: 80, taskResponse: 45 }), true);
    expect(result.offTopic).toBe(false);
    // 45*0.25 + fluency*0.25 + 80*0.2 + 80*0.2 + 80*0.1
    expect(result.scores.overall).toBe(Math.round(11.25 + ANALYSIS.scores.fluency * 0.25 + 16 + 16 + 8));
  });

  it("falls back to the AI overall score and notes missing prompts when task response is absent", () => {
    const result = mergeSpeakingScores(ANALYSIS, ai({ fluency: 80, grammar: 80, vocabulary: 80, coherence: 80 }, 72), false);
    expect(result.scores.taskResponse).toBeNull();
    expect(result.scores.fluency).toBe(ANALYSIS.scores.fluency);
    expect(result.scores.overall).toBe(72);
    expect(result.offTopic).toBe(false);
    expect(result.taskResponseNote).toMatch(/no task prompt/i);
  });

  it("leaves no note when a prompt existed but the model omitted task response", () => {
    const result = mergeSpeakingScores(ANALYSIS, ai({ fluency: 80, grammar: 80, vocabulary: 80, coherence: 80 }, 72), true);
    expect(result.scores.taskResponse).toBeNull();
    expect(result.taskResponseNote).toBeNull();
  });

  it("clamps AI skill scores to 0-100 and keeps measured fluency in range", () => {
    const result = mergeSpeakingScores(ANALYSIS, ai({ fluency: 120, grammar: -10, vocabulary: 80, coherence: 80, taskResponse: 150 }), true);
    expect(result.scores.fluency).toBe(ANALYSIS.scores.fluency);
    expect(result.scores.grammar).toBe(0);
    expect(result.scores.taskResponse).toBe(100);
  });
});