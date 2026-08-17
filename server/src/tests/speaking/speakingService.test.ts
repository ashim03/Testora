import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { ApiError } from "../../utils/helpers";

const mocks = vi.hoisted(() => ({
  attemptCreate: vi.fn(),
  attemptFindOne: vi.fn(),
  attemptFind: vi.fn(),
  attemptCountDocuments: vi.fn(),
  attemptUpdateOne: vi.fn(),
  learningProfileMock: vi.fn(),
  getMediaService: vi.fn(),
  getSttProvider: vi.fn(() => null),
}));

vi.mock("../../models", () => ({
  SpeakingAttempt: {
    create: mocks.attemptCreate,
    findOne: mocks.attemptFindOne,
    find: mocks.attemptFind,
    countDocuments: mocks.attemptCountDocuments,
    updateOne: mocks.attemptUpdateOne,
  },
  MediaAsset: {
    findById: vi.fn(() => Promise.resolve(null)),
    deleteOne: vi.fn(() => Promise.resolve()),
  },
  LearningProfile: {
    findOneAndUpdate: mocks.learningProfileMock,
  },
}));

vi.mock("../../services/mediaService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/mediaService")>();
  return {
    ...actual,
    getMediaService: mocks.getMediaService,
  };
});

vi.mock("../../services/stt", () => ({
  getSpeechToTextProvider: mocks.getSttProvider,
}));

import * as speakingService from "../../services/speakingService";

function buildWavBuffer(durationSec: number, sampleRate = 8000, bitsPerSample = 16): Buffer {
  const channels = 1;
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const payload = Buffer.alloc(durationSec * byteRate, 0);
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

const objectId = () => new Types.ObjectId().toHexString();

function baseAttempt() {
  return {
    studentId: "student-a",
    taskType: "FREE_PRACTICE",
    title: "Free practice",
    prompt: "",
    status: "PROCESSING",
    keepAudio: false,
    processingStartedAt: null,
    processedAt: null,
    error: null,
    audio: { assetId: "abc123", url: "/media/audio/abc123/file", mimeType: "audio/wav", format: "wav", sizeBytes: 100, durationSec: 12, retained: true },
    transcript: null,
    scores: null,
    metrics: null,
    report: null,
    createdAt: new Date(),
    save: vi.fn().mockResolvedValue(undefined),
  };
}

function fakeAttempt(overrides: Partial<Record<string, unknown>> = {}) {
  const base = baseAttempt();
  return { _id: objectId(), ...base, ...overrides };
}

/** Chainable mock matching the query API used by the service. */
function attemptChain(leanResult: unknown, selectResult?: unknown) {
  const chain = {
    sort: () => chain,
    skip: () => chain,
    limit: () => chain,
    select: () => Promise.resolve(selectResult !== undefined ? selectResult : leanResult),
    lean: () => Promise.resolve(leanResult),
  };
  return chain;
}

beforeEach(() => {
  mocks.attemptCreate.mockReset();
  mocks.attemptFindOne.mockReset();
  mocks.attemptFind.mockReset();
  mocks.attemptCountDocuments.mockReset();
  mocks.attemptUpdateOne.mockReset();
  mocks.learningProfileMock.mockReset();
  mocks.getMediaService.mockReset().mockReturnValue({
    upload: vi.fn(async () => ({ url: "/media/audio/abc123/file", publicId: "abc123.webm", provider: "local", assetId: "abc123" })),
    remove: vi.fn(async () => undefined),
  });
  mocks.getSttProvider.mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createSpeakingAttempt", () => {
  it("validates the audio, stores it and persists the attempt with real file metadata", async () => {
    mocks.attemptCreate.mockResolvedValue(fakeAttempt());
    const attempt = await speakingService.createSpeakingAttempt({
      studentId: "student-a",
      taskType: "FREE_PRACTICE",
      title: "",
      prompt: "Tell me about your home",
      reportedDurationSec: 12,
      buffer: buildWavBuffer(12),
      declaredMime: "audio/wav",
      filename: "untrusted-name.exe",
      keepAudio: false,
    });
    expect(attempt.status).toBe("PROCESSING");
    expect(attempt.studentId).toBe("student-a");
    const created = mocks.attemptCreate.mock.calls[0][0] as Record<string, unknown>;
    // Signature-based duration wins over the client report; the filename was never trusted.
    expect((created.audio as Record<string, unknown>).durationSec).toBe(12);
    expect((created.audio as Record<string, unknown>).mimeType).toBe("audio/wav");
    expect((created.audio as Record<string, unknown>).retained).toBe(true);
  });

  it("rejects invalid audio before touching storage or persistence", async () => {
    await expect(
      speakingService.createSpeakingAttempt({
        studentId: "student-a",
        taskType: "FREE_PRACTICE",
        title: "",
        prompt: "",
        reportedDurationSec: 2,
        buffer: buildWavBuffer(2),
        declaredMime: "audio/wav",
        filename: "short.wav",
        keepAudio: false,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.getMediaService).not.toHaveBeenCalled();
    expect(mocks.attemptCreate).not.toHaveBeenCalled();
  });
});

describe("ownership and authorization", () => {
  it("scopes read access to the requesting student", async () => {
    const id = objectId();
    mocks.attemptFindOne.mockReturnValue(attemptChain(null) as never);
    await expect(speakingService.getSpeakingAttempt("student-a", id)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.attemptFindOne).toHaveBeenCalledWith({ _id: id, studentId: "student-a" });
  });

  it("scopes retry to the requesting student", async () => {
    const id = objectId();
    mocks.attemptFindOne.mockResolvedValue(null);
    await expect(speakingService.retrySpeakingAttempt("student-a", id)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.attemptFindOne).toHaveBeenCalledWith({ _id: id, studentId: "student-a" });
  });

  it("rejects malformed ids without touching the database", async () => {
    const error = await speakingService.getSpeakingAttempt("student-a", "junk").catch((e: ApiError) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(404);
    expect(mocks.attemptFindOne).not.toHaveBeenCalled();
  });

  it("only allows retry of failed attempts owned by the student", async () => {
    const failed = fakeAttempt({ status: "FAILED" });
    mocks.attemptFindOne.mockResolvedValue(failed);
    const retried = await speakingService.retrySpeakingAttempt("student-a", String(failed._id));
    expect(failed.status).toBe("PROCESSING");
    expect(retried.status).toBe("PROCESSING");
    expect(failed.save).toHaveBeenCalled();

    mocks.attemptFindOne.mockResolvedValue(fakeAttempt({ status: "COMPLETED" }));
    await expect(speakingService.retrySpeakingAttempt("student-a", objectId())).rejects.toMatchObject({ statusCode: 400 });

    mocks.attemptFindOne.mockResolvedValue(null);
    await expect(speakingService.retrySpeakingAttempt("student-a", objectId())).rejects.toMatchObject({ statusCode: 404 });
  });

  it("refuses retry once the raw audio has been cleaned up", async () => {
    const attempt = fakeAttempt({ status: "FAILED", audio: { ...baseAttempt().audio, retained: false } });
    mocks.attemptFindOne.mockResolvedValue(attempt);
    await expect(speakingService.retrySpeakingAttempt("student-a", String(attempt._id))).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("processing lifecycle", () => {
  it("marks the attempt FAILED with a clear error when transcription is unavailable", async () => {
    mocks.getSttProvider.mockReturnValue(null);
    const attempt = fakeAttempt();
    mocks.attemptFindOne.mockResolvedValue(attempt);
    const result = await speakingService.processSpeakingAttempt(String(attempt._id));
    expect(result.status).toBe("FAILED");
    expect(String(result.error)).toMatch(/speech-to-text is not configured/i);
    expect(mocks.attemptFindOne).toHaveBeenCalledWith({ _id: String(attempt._id), status: "PROCESSING" });
  });

  it("recoverStuckSpeakingAttempts fails stale PROCESSING attempts", async () => {
    mocks.attemptFind.mockReturnValue(attemptChain([fakeAttempt(), fakeAttempt()], [fakeAttempt(), fakeAttempt()]) as never);
    mocks.attemptUpdateOne.mockResolvedValue({});
    const recovered = await speakingService.recoverStuckSpeakingAttempts();
    expect(recovered).toBe(2);
    expect(mocks.attemptUpdateOne).toHaveBeenCalledTimes(2);
    expect(mocks.attemptUpdateOne.mock.calls[0][1].$set.status).toBe("FAILED");
  });
});

describe("progress analytics", () => {
  it("aggregates completed attempts into skill breakdown, trend and weakest skill", async () => {
    const mk = (score: number, createdAt: Date) =>
      fakeAttempt({
        status: "COMPLETED",
        createdAt,
        scores: { overall: score, fluency: score, grammar: score - 10, vocabulary: score + 5, coherence: score - 5 },
        metrics: { wpm: 140, durationSec: 60, words: 140, sentences: 10, fillerWordCount: 2, fillerWords: [], pauseCount: 4, pauseFrequencyPerMinute: 4, repetitionCount: 0, repeatedPhrases: [], avgWordsPerSentence: 14, sentenceComplexity: "medium", typeTokenRatio: 0.6 },
      });
    mocks.attemptFind.mockReturnValue(attemptChain([
      mk(72, new Date("2026-08-10")),
      mk(60, new Date("2026-08-05")),
      mk(66, new Date("2026-07-28")),
    ]) as never);
    mocks.attemptCountDocuments.mockResolvedValue(3);
    const progress = await speakingService.getSpeakingProgress("student-a");
    expect(progress.totals.attempts).toBe(3);
    expect(progress.totals.averageOverall).toBe(66);
    expect(progress.totals.averageWpm).toBe(140);
    expect(progress.skills.find((s) => s.skill === "grammar")?.score).toBe(56);
    expect(progress.trend).toHaveLength(3);
    expect(progress.weakestSkill?.skill).toBe("grammar");
    expect(progress.byTaskType.find((t) => t.taskType === "FREE_PRACTICE")?.count).toBe(3);
  });
});