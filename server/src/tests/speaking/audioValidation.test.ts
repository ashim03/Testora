import { describe, it, expect } from "vitest";
import {
  detectAudioFormat,
  parseWavDuration,
  parseWebmDuration,
  validateSpeakingAudio,
  formatMatchesMime,
} from "../../utils/audioValidation";
import { ApiError } from "../../utils/helpers";

// ---------------------------------------------------------------------------
// Buffer builders
// ---------------------------------------------------------------------------

function buildWavBuffer(durationSec: number, dataSize?: number, sampleRate = 8000, bitsPerSample = 16): Buffer {
  const channels = 1;
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const payload = Buffer.alloc(dataSize ?? durationSec * byteRate, 0);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + payload.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE((channels * bitsPerSample) / 8, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(payload.length, 40);
  return Buffer.concat([header, payload]);
}

function vint(value: number): Buffer {
  const bytes: number[] = [];
  let remaining = value;
  while (remaining >= 0x80) {
    bytes.unshift(remaining & 0xff);
    remaining = Math.floor(remaining / 256);
  }
  bytes.unshift(remaining & 0xff);
  const out = Buffer.alloc(bytes.length);
  out[0] = 0x80 | bytes[0]!;
  for (let i = 1; i < bytes.length; i++) out[i] = bytes[i]!;
  return out;
}

function buildWebmBuffer(
  durationSec: number,
  options: { scaleBytes?: number; scaleFirst?: boolean } = {},
): Buffer {
  const { scaleBytes = 8, scaleFirst = true } = options;
  const header = Buffer.concat([
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), // EBML
    vint(4),
    Buffer.from("webm", "ascii"),
  ]);
  const scale = Buffer.alloc(scaleBytes);
  if (scaleBytes === 8) scale.writeBigUInt64BE(BigInt(1000000));
  else scale.writeUIntBE(1000000, 0, scaleBytes);
  const durationBuf = Buffer.alloc(8);
  durationBuf.writeDoubleBE(durationSec * 1000);
  const scaleElement = Buffer.concat([Buffer.from([0x2a, 0xd7, 0xb1]), vint(scaleBytes), scale]);
  const durationElement = Buffer.concat([Buffer.from([0x44, 0x89]), vint(8), durationBuf]);
  const info = Buffer.concat(scaleFirst ? [scaleElement, durationElement] : [durationElement, scaleElement]);
  const infoElement = Buffer.concat([Buffer.from([0x15, 0x49, 0xa9, 0x66]), vint(info.length), info]);
  const segment = Buffer.concat([Buffer.from([0x18, 0x53, 0x80, 0x67]), vint(infoElement.length), infoElement]);
  return Buffer.concat([header, segment]);
}

const baseOptions = { maxDurationSec: 180, minDurationSec: 5, maxSizeBytes: 10 * 1024 * 1024 };

describe("detectAudioFormat (file signatures, not names or MIME)", () => {
  it("detects wav from the RIFF/WAVE signature", () => {
    expect(detectAudioFormat(buildWavBuffer(5))).toBe("wav");
  });
  it("detects webm from the EBML magic", () => {
    expect(detectAudioFormat(buildWebmBuffer(5))).toBe("webm");
  });
  it("detects mp3 ID3 and frame sync signatures", () => {
    expect(detectAudioFormat(Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]))).toBe("mp3");
    expect(detectAudioFormat(Buffer.from([0xff, 0xfb, 0x90, 0x00]))).toBe("mp3");
  });
  it("rejects random payloads", () => {
    expect(detectAudioFormat(Buffer.from("not an audio file at all", "ascii"))).toBeNull();
  });
  it("formatMatchesMime requires declared MIME to match the signature", () => {
    expect(formatMatchesMime("wav", "audio/wav")).toBe(true);
    expect(formatMatchesMime("wav", "audio/mp3")).toBe(false);
    expect(formatMatchesMime("webm", "audio/webm")).toBe(true);
    expect(formatMatchesMime("mp3", "audio/ogg")).toBe(false);
  });
});

describe("duration parsing (independent of the client report)", () => {
  it("parses wav duration from the data chunk", () => {
    const duration = parseWavDuration(buildWavBuffer(5));
    expect(duration).toBeCloseTo(5, 1);
    expect(parseWavDuration(buildWavBuffer(12))).toBeCloseTo(12, 1);
  });
  it("parses webm duration from the Segment/Info block", () => {
    expect(parseWebmDuration(buildWebmBuffer(5))).toBeCloseTo(5, 2);
    expect(parseWebmDuration(buildWebmBuffer(42))).toBeCloseTo(42, 2);
  });
  it("parses webm duration when TimecodeScale is a 3-byte uint (ffmpeg-style)", () => {
    expect(parseWebmDuration(buildWebmBuffer(9.25, { scaleBytes: 3 }))).toBeCloseTo(9.25, 2);
  });
  it("parses webm duration when Duration precedes TimecodeScale in the Info block", () => {
    expect(parseWebmDuration(buildWebmBuffer(12, { scaleFirst: false }))).toBeCloseTo(12, 2);
  });
  it("returns the duration when the TimecodeScale element is missing (defaults to 1 ms)", () => {
    const buffer = buildWebmBuffer(5);
    const infoStart = buffer.indexOf(Buffer.from([0x15, 0x49, 0xa9, 0x66]));
    expect(infoStart).toBeGreaterThan(0);
    // Info header (5 bytes) + TimecodeScale element (3 id + 1 size + 8 data).
    const scaleStart = infoStart + 5;
    const withoutScale = Buffer.concat([buffer.subarray(0, scaleStart), buffer.subarray(scaleStart + 12)]);
    expect(parseWebmDuration(withoutScale)).toBeCloseTo(5, 2);
  });
  it("returns null for non-parseable audio", () => {
    expect(parseWavDuration(Buffer.from([0x49, 0x44, 0x33, 0x00, 0x00, 0x00]))).toBeNull();
    expect(parseWavDuration(Buffer.alloc(10))).toBeNull();
    expect(parseWebmDuration(Buffer.from("garbage"))).toBeNull();
  });
});

describe("validateSpeakingAudio", () => {
  it("accepts a valid wav within bounds and reports the parsed duration", () => {
    const result = validateSpeakingAudio(buildWavBuffer(12), "audio/wav", 0, baseOptions);
    expect(result.format).toBe("wav");
    expect(result.durationSec).toBe(12);
  });
  it("accepts a valid webm and reports the parsed duration", () => {
    const result = validateSpeakingAudio(buildWebmBuffer(30), "audio/webm", 999, baseOptions);
    expect(result.durationSec).toBe(30);
  });
  it("rejects oversized files", () => {
    const wav = buildWavBuffer(5);
    expect(() => validateSpeakingAudio(wav, "audio/wav", 5, { ...baseOptions, maxSizeBytes: wav.length - 1 })).toThrowError(/too large/i);
  });
  it("rejects unsupported MIME types", () => {
    expect(() => validateSpeakingAudio(buildWavBuffer(5), "text/plain", 5, baseOptions)).toThrowError(/unsupported audio type/i);
  });
  it("rejects files whose signature does not match the declared MIME type", () => {
    expect(() => validateSpeakingAudio(buildWavBuffer(5), "audio/mp3", 5, baseOptions)).toThrowError(/does not match its declared type/i);
  });
  it("rejects files that are not audio at all", () => {
    expect(() => validateSpeakingAudio(Buffer.from("definitely not audio", "ascii"), "audio/wav", 5, baseOptions)).toThrowError(/not a recognised audio file/i);
  });
  it("rejects recordings shorter than the minimum duration", () => {
    expect(() => validateSpeakingAudio(buildWavBuffer(2), "audio/wav", 2, baseOptions)).toThrowError(/too short/i);
  });
  it("rejects recordings longer than the maximum duration", () => {
    expect(() => validateSpeakingAudio(buildWavBuffer(200), "audio/wav", 200, baseOptions)).toThrowError(/too long/i);
  });
  it("trusts the parsed duration over a bogus client report", () => {
    const result = validateSpeakingAudio(buildWavBuffer(10), "audio/wav", 3600, baseOptions);
    expect(result.durationSec).toBe(10);
  });
  it("rejects a client-reported duration that cannot fit the file size", () => {
    // Small mp3-like file with a huge claimed duration: impossible.
    const tinyMp3 = Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x00]), Buffer.alloc(500)]);
    expect(() => validateSpeakingAudio(tinyMp3, "audio/mpeg", 3600, baseOptions)).toThrowError(/not consistent/i);
  });
  it("is an ApiError with a 400 status", () => {
    try {
      validateSpeakingAudio(buildWavBuffer(2), "audio/wav", 2, baseOptions);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(400);
    }
  });
});