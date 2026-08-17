import { afterEach, describe, expect, it, vi } from "vitest";
import { QwenAsrSttProvider } from "../../services/stt/qwenAsrSttProvider";
import { SttUnavailableError } from "../../services/stt/speechToTextProvider";

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

describe("QwenAsrSttProvider", () => {
  it("returns a transcript parsed from chat/completions content", async () => {
    const fetchMock = fakeFetch({
      choices: [
        {
          message: {
            content: "The quick brown fox jumps over the lazy dog.",
            annotations: [{ type: "audio_info", language: "en", emotion: "neutral" }],
          },
          finish_reason: "stop",
        },
      ],
      usage: { seconds: 4 },
    });
    vi.stubGlobal("fetch", fetchMock);
    const provider = new QwenAsrSttProvider({ apiKey: "sk-test", baseUrl: "https://stt.example.com/v1" });

    const transcript = await provider.transcribe(input);
    expect(transcript.text).toBe("The quick brown fox jumps over the lazy dog.");
    expect(transcript.language).toBe("en");
    expect(transcript.durationSec).toBe(4);
    expect(transcript.confidence).toBeUndefined();
    expect(provider.name).toBe("qwen-asr:qwen3-asr-flash-2026-02-10");
    expect(provider.configured()).toBe(true);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://stt.example.com/v1/chat/completions");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("qwen3-asr-flash-2026-02-10");
    expect(body.messages[0].content[0].type).toBe("input_audio");
    expect(body.messages[0].content[0].input_audio.data.startsWith("data:audio/webm;base64,")).toBe(true);
    expect(body.asr_options).toEqual({ language: "en", enable_itn: false });
  });

  it("uses STT_MODEL/STT_BASE_URL env with AI_* fallback", () => {
    vi.stubEnv("STT_API_KEY", "");
    vi.stubEnv("STT_MODEL", "");
    vi.stubEnv("STT_BASE_URL", "");
    vi.stubEnv("AI_API_KEY", "shared-key");
    vi.stubEnv("AI_BASE_URL", "https://ai.example.com/v1/");
    const provider = new QwenAsrSttProvider();
    expect(provider.configured()).toBe(true);
  });

  it("throws SttUnavailableError when not configured", async () => {
    vi.stubEnv("STT_API_KEY", "");
    vi.stubEnv("STT_BASE_URL", "");
    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("AI_BASE_URL", "");
    const provider = new QwenAsrSttProvider();
    expect(provider.configured()).toBe(false);
    await expect(provider.transcribe(input)).rejects.toBeInstanceOf(SttUnavailableError);
  });

  it("maps 401/403 to SttUnavailableError (bad credentials)", async () => {
    vi.stubGlobal("fetch", fakeFetch({ error: "unauthorized" }, 401));
    await expect(new QwenAsrSttProvider({ apiKey: "bad", baseUrl: "https://s/v1" }).transcribe(input)).rejects.toBeInstanceOf(SttUnavailableError);
    vi.stubGlobal("fetch", fakeFetch({ error: "forbidden" }, 403));
    await expect(new QwenAsrSttProvider({ apiKey: "bad", baseUrl: "https://s/v1" }).transcribe(input)).rejects.toBeInstanceOf(SttUnavailableError);
  });

  it("maps 400/404/405 to SttUnavailableError (model or route not enabled)", async () => {
    for (const status of [400, 404, 405]) {
      vi.stubGlobal("fetch", fakeFetch({ error: "not found" }, status));
      await expect(new QwenAsrSttProvider({ apiKey: "k", baseUrl: "https://s/v1" }).transcribe(input)).rejects.toBeInstanceOf(SttUnavailableError);
    }
  });

  it("maps 5xx to ApiError 502", async () => {
    vi.stubGlobal("fetch", fakeFetch({ error: "boom" }, 500));
    await expect(new QwenAsrSttProvider({ apiKey: "k", baseUrl: "https://s/v1" }).transcribe(input)).rejects.toMatchObject({ statusCode: 502 });
  });

  it("rejects empty transcripts", async () => {
    vi.stubGlobal("fetch", fakeFetch({ choices: [{ message: { content: "   " } }] }));
    await expect(new QwenAsrSttProvider({ apiKey: "k", baseUrl: "https://s/v1" }).transcribe(input)).rejects.toMatchObject({ statusCode: 502 });
  });

  it("rejects audio whose base64 payload would exceed the DashScope limit", async () => {
    const big = { buffer: Buffer.alloc(8 * 1024 * 1024, 1), mimeType: "audio/wav", filename: "big.wav" };
    vi.stubGlobal("fetch", vi.fn());
    await expect(new QwenAsrSttProvider({ apiKey: "k", baseUrl: "https://s/v1" }).transcribe(big)).rejects.toMatchObject({ statusCode: 413 });
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("times out with ApiError 504", async () => {
    const fetchMock = vi.fn().mockRejectedValue(Object.assign(new Error("timeout"), { name: "TimeoutError" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(new QwenAsrSttProvider({ apiKey: "k", baseUrl: "https://s/v1" }).transcribe(input)).rejects.toMatchObject({ statusCode: 504 });
  });
});
