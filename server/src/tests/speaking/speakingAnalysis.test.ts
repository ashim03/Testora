import { describe, it, expect } from "vitest";
import {
  analyzeTranscript,
  countFillerWords,
  detectRepeatedPhrases,
  splitSentences,
  tokenizeWords,
} from "../../services/speakingAnalysisService";

const SAMPLE = `I think staying healthy is important for everyone. Um, first of all I like to exercise in the morning because it gives me energy. Um, and I mean, when I exercise I feel better during the whole day. Actually, my favorite activity is running, and I usually run for about thirty minutes every day. For example, last week I ran five times and um I felt really productive. However, sometimes I struggle to keep the habit, you know, but I try my best every day. Overall, I believe small habits make a big difference in the long term.`;

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