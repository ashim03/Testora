import { describe, expect, it } from "vitest";
import {
  SYNTHETIC_SPEAKING,
  SYNTHETIC_TOTAL,
  SYNTHETIC_WRITING,
} from "./eval/syntheticDataset";

const GRAMMAR_ERROR_PATTERNS = [
  "there is many",
  "many reason",
  "peoples",
  "informations",
  "childrens",
  "more better",
  "advices",
  "in last year",
  "is more big",
  "many researches",
  "it depend on",
  "should continues",
  "do not change",
  "peopless",
];

const hasInjectedError = (text: string) => GRAMMAR_ERROR_PATTERNS.some((p) => text.includes(p));

describe("synthetic eval dataset", () => {
  it("contains at least 200 deterministic samples with unique names", () => {
    expect(SYNTHETIC_TOTAL).toBeGreaterThanOrEqual(200);
    const names = [...SYNTHETIC_WRITING, ...SYNTHETIC_SPEAKING].map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    expect(SYNTHETIC_WRITING.length).toBe(192);
    expect(SYNTHETIC_SPEAKING.length).toBe(64);
  });

  it("covers the expected variants and band range", () => {
    const variants = new Set(SYNTHETIC_WRITING.map((s) => s.variant));
    expect(variants).toEqual(
      new Set(["TASK2_ESSAY", "GT_LETTER", "ACADEMIC_TASK1", "PTE_SUMMARIZE"])
    );
    const speakingVariants = new Set(SYNTHETIC_SPEAKING.map((s) => s.variant));
    expect(speakingVariants).toEqual(new Set(["IELTS_PART2", "PTE_RETELL", "PTE_DESCRIBE_IMAGE"]));
    const bands = SYNTHETIC_WRITING.map((s) => s.expectedIelts);
    expect(Math.min(...bands)).toBeLessThanOrEqual(5.5);
    expect(Math.max(...bands)).toBeGreaterThanOrEqual(8);
  });

  it("injects grammar errors only into low and mid band writing samples", () => {
    for (const s of SYNTHETIC_WRITING) {
      const isLow = s.expectedIelts <= 5.5;
      const isMid = s.expectedIelts >= 6 && s.expectedIelts <= 7;
      if (isLow) {
        if (s.variant === "PTE_SUMMARIZE") continue; // summarize low markers are content/form based
        expect(hasInjectedError(s.essay), s.name + " should contain grammar errors").toBe(true);
      } else if (isMid) {
        // Mid samples may or may not carry a single injected error; they must never contain repeated ones.
        expect(s.essay.includes("peopless"), s.name).toBe(false);
      } else {
        expect(hasInjectedError(s.essay), s.name + " high tier must be error-free").toBe(false);
      }
    }
  });

  it("keeps word counts plausible for each band tier", () => {
    const words = (t: string) => t.split(/\s+/).length;
    for (const s of SYNTHETIC_WRITING) {
      const count = words(s.essay);
      if (s.expectedIelts >= 7.5) {
        if (s.variant === "TASK2_ESSAY") expect(count, s.name).toBeGreaterThanOrEqual(250);
        if (s.variant === "GT_LETTER" || s.variant === "ACADEMIC_TASK1") {
          expect(count, s.name).toBeGreaterThanOrEqual(100);
        }
      }
      if (s.expectedIelts <= 5.5) {
        if (s.variant === "TASK2_ESSAY") expect(count, s.name).toBeLessThan(200);
        if (s.variant === "GT_LETTER") expect(count, s.name).toBeLessThan(165);
      }
    }
    for (const s of SYNTHETIC_SPEAKING) {
      expect(s.transcript.length, s.name).toBeGreaterThan(60);
      expect(s.durationSec, s.name).toBeGreaterThanOrEqual(40);
    }
  });

  it("caps PTE scores at 80 for summarize written text samples", () => {
    for (const s of SYNTHETIC_WRITING) {
      if (s.variant === "PTE_SUMMARIZE") expect(s.expectedPte, s.name).toBeLessThanOrEqual(80);
    }
  });

  it("generates consistent content on regeneration", async () => {
    const fresh = (await import("./eval/syntheticDataset?regenerate=1")) as typeof import("./eval/syntheticDataset");
    expect(fresh.SYNTHETIC_WRITING[0].essay).toBe(SYNTHETIC_WRITING[0].essay);
    expect(fresh.SYNTHETIC_SPEAKING[0].transcript).toBe(SYNTHETIC_SPEAKING[0].transcript);
  });
});