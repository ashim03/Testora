import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAICompatibleSttProvider } from "../../services/stt/openAiCompatibleSttProvider";
import { SttUnavailableError } from "../../services/stt/speechToTextProvider";
import { ApiError } from "../../utils/helpers";

function fakeFetch(payload: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: () => Promise.resolve(payload),
  });
}

const input = { buffer: Buffer.from("fake-audio"), mimeType: "audio/webm", filename: "speaking.webm" };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("OpenAICompatibleSttProvider", () => {
  it("implements the SpeechToTextProvider contract and returns a mapping transcript", async () => {
    const fetchMock = fakeFetch({ text: "The quick brown fox.", language: "en", segments: [{ confidence: 0.94 }, { confidence: 0.9 }] }, 200);
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAICompatibleSttProvider({ apiKey: "sk-test", baseUrl: "https://stt.example.com/v1" });

    const transcript = await provider.transcribe(input);
    expect(transcript.text).toBe("The quick brown fox.");
    expect(transcript.language).toBe("en");
    expect(transcript.confidence).toBeCloseTo(0.92, 2);
    expect(provider.name).toContain("openai-compatible");
    expect(provider.configured()).toBe(true);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://stt.example.com/v1/audio/transcriptions");
    expect(init.method ?? "POST").toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("falls back to AI_* env credentials and default endpoints", () => {
    vi.stubEnv("STT_API_KEY", "");
    vi.stubEnv("AI_API_KEY", "shared-key");
    vi.stubEnv("AI_BASE_URL", "https://ai.example.com/v1/");
    const provider = new OpenAICompatibleSttProvider();
    expect(provider.configured()).toBe(true);
  });

  it("throws SttUnavailableError when not configured", async () => {
    vi.stubEnv("STT_API_KEY", "");
    vi.stubEnv("AI_API_KEY", "");
    const provider = new OpenAICompatibleSttProvider();
    expect(provider.configured()).toBe(false);
    await expect(provider.transcribe(input)).rejects.toBeInstanceOf(SttUnavailableError);
  });

  it("maps 401/403 to SttUnavailableError (bad credentials)", async () => {
    vi.stubGlobal("fetch", fakeFetch({ error: "unauthorized" }, 401));
    await expect(new OpenAICompatibleSttProvider({ apiKey: "bad", baseUrl: "https://s/v1" }).transcribe(input)).rejects.toBeInstanceOf(SttUnavailableError);
  });

  it("maps upstream 5xx failures to a 502 ApiError", async () => {
    vi.stubGlobal("fetch", fakeFetch({ error: "boom" }, 500));
    const failure = await new OpenAICompatibleSttProvider({ apiKey: "sk", baseUrl: "https://s/v1" }).transcribe(input).catch((e) => e);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).statusCode).toBe(502);
  });

  it("maps timeouts to a 504 ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("The operation timed out", "TimeoutError")));
    const failure = await new OpenAICompatibleSttProvider({ apiKey: "sk", baseUrl: "https://s/v1", timeoutMs: 50 }).transcribe(input).catch((e) => e);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).statusCode).toBe(504);
  });

  it("rejects empty transcripts", async () => {
    vi.stubGlobal("fetch", fakeFetch({ text: "   " }, 200));
    await expect(new OpenAICompatibleSttProvider({ apiKey: "sk", baseUrl: "https://s/v1" }).transcribe(input)).rejects.toMatchObject({ statusCode: 502 });
  });
});