import { describe, expect, it } from "vitest";
import { fillerWordBases, transcriptIsFiller } from "../utils/speaking";
import { isVoiceRecordingSupported } from "../components/speaking/VoiceRecorder";

describe("fillerWordBases", () => {
  it("extracts the first word of each filler entry", () => {
    expect(fillerWordBases(["like (×3)", "um (×2)", "you know (×1)"])).toEqual(["like", "um", "you"]);
  });
  it("drops empty entries", () => {
    expect(fillerWordBases(["", "  "])).toEqual([]);
  });
  it("returns empty for no fillers", () => {
    expect(fillerWordBases([])).toEqual([]);
  });
});

describe("transcriptIsFiller", () => {
  it("matches filler words case-insensitively", () => {
    expect(transcriptIsFiller("Um,", ["um"])).toBe(true);
    expect(transcriptIsFiller("actually", ["actually"])).toBe(true);
    expect(transcriptIsFiller("Actually", ["actually"])).toBe(true);
  });
  it("does not highlight ordinary words or the filler root of longer words", () => {
    expect(transcriptIsFiller("understand", ["um"])).toBe(false);
    expect(transcriptIsFiller("apple", ["like"])).toBe(false);
    expect(transcriptIsFiller("a", ["a"])).toBe(false);
  });
});

describe("isVoiceRecordingSupported", () => {
  it("returns false when the MediaRecorder API is missing", () => {
    const original = globalThis.MediaRecorder;
    Object.defineProperty(globalThis, "MediaRecorder", { value: undefined, configurable: true, writable: true });
    expect(isVoiceRecordingSupported()).toBe(false);
    Object.defineProperty(globalThis, "MediaRecorder", { value: original, configurable: true, writable: true });
  });
});