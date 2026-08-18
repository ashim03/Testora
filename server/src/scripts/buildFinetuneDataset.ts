/**
 * Builds an OpenAI-compatible fine-tuning dataset (JSONL) from the synthetic
 * IELTS/PTE eval samples. Each record mirrors the exact input the live scorer
 * builds (buildScoringInput split into system/user) and a deterministic
 * assistant target derived from the sample labels, so a fine-tuned model can
 * replace the prompt-engineering + deterministic post-processing pipeline.
 *
 * Usage: npm run build:ft
 * Output: finetune/train.jsonl, finetune/valid.jsonl (90/10 split, seeded).
 */
import fs from "fs";
import path from "path";
import { SYNTHETIC_SPEAKING, SYNTHETIC_WRITING, type SyntheticSpeakingSample, type SyntheticWritingSample } from "../tests/eval/syntheticDataset";
import { buildScoringInput, type WritingRubricVariant } from "../services/aiFeedbackService";
import { analyzeTranscript } from "../services/speakingAnalysisService";
import { pteFromIelts } from "../utils/bandScales";

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** Deterministic PRNG (mulberry32) so regeneration produces identical files. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Tier = "high" | "mid" | "low";

const tierOf = (band: number): Tier => (band >= 7.5 ? "high" : band >= 6 ? "mid" : "low");

const STRENGTHS: Record<Tier, string[]> = {
  high: [
    "Clear structure with a recognisable introduction, developed body paragraphs, and a conclusion.",
    "A good range of vocabulary and sentence structures is used naturally throughout.",
  ],
  mid: [
    "The task is addressed with a clear position and organised paragraphs.",
    "The response stays on topic and covers the main points of the prompt.",
  ],
  low: [
    "The response addresses the task and follows a basic structure.",
    "Some relevant ideas are present, and the overall purpose is clear.",
  ],
};

const IMPROVEMENTS: Record<Tier, string[]> = {
  high: [],
  mid: [
    "Develop each point with more specific examples and detail.",
    "Vary sentence structures to move beyond simple sentences.",
  ],
  low: [
    "Focus on accuracy: review articles, plurals, and subject-verb agreement.",
    "Build topic vocabulary so ideas can be expressed more precisely.",
    "Develop ideas fully instead of repeating the same point in different words.",
  ],
};

const NEXT_STEPS: Record<Tier, string[]> = {
  high: ["Maintain this standard under timed conditions.", "Keep refining collocations on a wider range of topics."],
  mid: ["Practise expanding ideas with concrete examples before writing.", "Review linking devices to connect paragraphs more fluently."],
  low: ["Complete daily accuracy drills on the error patterns above.", "Write short paragraphs on familiar topics and then self-correct.", "Learn ten topic-specific words each week and use them in sentences."],
};

function skillScoresFor(band: number): Record<string, number> {
  const tier = tierOf(band);
  const base = (band / 9) * 100;
  const offset = tier === "high" ? 5 : tier === "mid" ? 0 : -8;
  const taskResponseOffset = tier === "high" ? 5 : tier === "mid" ? 0 : -3;
  return {
    grammar: clamp(base + offset),
    vocabulary: clamp(base + offset),
    coherence: clamp(base + offset),
    fluency: clamp(base + offset),
    taskResponse: clamp(base + taskResponseOffset),
  };
}

function targetFor(sample: SyntheticWritingSample | SyntheticSpeakingSample, variantLabel: WritingRubricVariant | "SPEAKING"): Record<string, unknown> {
  const band = sample.expectedIelts;
  const tier = tierOf(band);
  const skills = skillScoresFor(band);
  const overall = clamp((skills.grammar + skills.vocabulary + skills.coherence + skills.taskResponse) / 4);
  return {
    overallScore: overall,
    skillScores: skills,
    strengths: STRENGTHS[tier],
    improvements: IMPROVEMENTS[tier],
    grammar: [],
    vocabulary: [],
    coherence: [],
    fluency: [],
    pronunciation: [],
    nextSteps: NEXT_STEPS[tier],
    disclaimer: "AI-generated formative feedback; not an official IELTS/PTE score.",
    bands: { ielts: band, pte: sample.expectedPte ?? pteFromIelts(band) },
    annotations: [],
    modelAnswer: null,
    advice: null,
  };
}

function recordFor(
  system: string,
  user: string,
  target: Record<string, unknown>
): string {
  return JSON.stringify({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
      { role: "assistant", content: JSON.stringify(target) },
    ],
  });
}

function main() {
  const records: Array<{ system: string; user: string; target: Record<string, unknown>; name: string }> = [];

  for (const sample of SYNTHETIC_WRITING) {
    const input = buildScoringInput("WRITING", sample.essay, sample.prompt);
    const splitAt = input.indexOf("\nTask prompt: ");
    if (splitAt === -1) throw new Error("unexpected scoring input layout for " + sample.name);
    records.push({
      system: input.slice(0, splitAt),
      user: input.slice(splitAt + 1),
      target: targetFor(sample, sample.variant),
      name: sample.name,
    });
  }

  for (const sample of SYNTHETIC_SPEAKING) {
    const analysis = analyzeTranscript({ text: sample.transcript, durationSec: sample.durationSec });
    const input = buildScoringInput("SPEAKING", sample.transcript, sample.prompt, {
      words: analysis.metrics.words,
      wpm: analysis.metrics.wpm,
      fillerWordCount: analysis.metrics.fillerWordCount,
      pauseFrequencyPerMinute: analysis.metrics.pauseFrequencyPerMinute,
    });
    const splitAt = input.indexOf("\nTask prompt: ");
    if (splitAt === -1) throw new Error("unexpected scoring input layout for " + sample.name);
    records.push({
      system: input.slice(0, splitAt),
      user: input.slice(splitAt + 1),
      target: targetFor(sample, "SPEAKING"),
      name: sample.name,
    });
  }

  // Deterministic 90/10 train/valid split.
  const rng = makeRng(20260818);
  const shuffled = records.map((r, i) => ({ r, i })).sort(() => rng() - 0.5);
  const split = Math.floor(shuffled.length * 0.9);
  const train = shuffled.slice(0, split).map(({ r }) => r);
  const valid = shuffled.slice(split).map(({ r }) => r);

  const outDir = path.resolve(process.cwd(), "finetune");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "train.jsonl"), train.map((r) => recordFor(r.system, r.user, r.target)).join("\n") + "\n");
  fs.writeFileSync(path.join(outDir, "valid.jsonl"), valid.map((r) => recordFor(r.system, r.user, r.target)).join("\n") + "\n");

  const bands = records.map((r) => (r.target.bands as { ielts: number }).ielts);
  const unique = [...new Set(bands)].sort((a, b) => a - b);
  console.log(`Fine-tuning dataset written to ${outDir}`);
  console.log(`  total records: ${records.length} (train ${train.length} / valid ${valid.length})`);
  console.log(`  band distribution: ${unique.map((b) => `${b}:${bands.filter((x) => x === b).length}`).join("  ")}`);
  console.log(`  samples per file: ${(fs.statSync(path.join(outDir, "train.jsonl")).size / 1024).toFixed(0)} KB train, ${(fs.statSync(path.join(outDir, "valid.jsonl")).size / 1024).toFixed(0)} KB valid`);
  console.log("\nNext: upload these files and launch a LoRA fine-tune on Alibaba MaaS:");
  console.log(`  curl -s https://dashscope.aliyuncs.com/api/v1/files -H "Authorization: Bearer $AI_API_KEY" -F "files=@${path.join(outDir, "train.jsonl")}" -F "purpose=file-extract"`);
  console.log(`  curl -s https://dashscope.aliyuncs.com/api/v1/fine-tunes -H "Authorization: Bearer $AI_API_KEY" -H "Content-Type: application/json" -d '{"training_file_ids":["<file-id>"],"model":"qwen-plus","method":{"type":"lora","lora_rank":8,"lora_alpha":32,"lora_dropout":0.1},"parameters":{"epochs":2,"learning_rate":0.00003,"batch_size":8}}'`);
}

main();