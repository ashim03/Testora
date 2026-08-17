import { ApiError } from "../../utils/helpers";
import { OpenAICompatibleSttProvider } from "./openAiCompatibleSttProvider";
import { SttUnavailableError, type SpeechToTextProvider, type Transcript, type TranscriptionInput } from "./speechToTextProvider";

/**
 * Qwen-ASR via the OpenAI-compatible chat completions interface.
 *
 * Alibaba Model Studio's Qwen3-ASR-Flash models are exposed through
 * `POST {base}/chat/completions` with an `input_audio` message carrying a
 * base64 data URL, rather than the classic `/audio/transcriptions` route
 * (which is not exposed on workspace MaaS gateways). The transcribed text is
 * returned in `choices[0].message.content`.
 *
 * Credentials: STT_API_KEY/STT_MODEL/STT_BASE_URL, falling back to the
 * platform's shared AI_* values so a single key can power both scoring and
 * transcription.
 *
 * NOTE: the payload is base64, which inflates the upload by ~33%. DashScope
 * caps the encoded input at ~10 MB, so attempts whose encoded audio exceeds
 * MAX_BASE64_BYTES are rejected with a clear error before hitting the API.
 */
export class QwenAsrSttProvider implements SpeechToTextProvider {
  readonly name: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options?: { apiKey?: string; baseUrl?: string; model?: string; timeoutMs?: number }) {
    this.apiKey = options?.apiKey || process.env.STT_API_KEY || process.env.AI_API_KEY || "";
    this.baseUrl = (options?.baseUrl || process.env.STT_BASE_URL || process.env.AI_BASE_URL || "").replace(/\/$/, "");
    this.model = options?.model || process.env.STT_MODEL || "qwen3-asr-flash-2026-02-10";
    this.timeoutMs = options?.timeoutMs || 120000;
    this.name = `qwen-asr:${this.model}`;
  }

  configured(): boolean {
    return Boolean(this.apiKey && this.baseUrl);
  }

  async transcribe(input: TranscriptionInput): Promise<Transcript> {
    if (!this.apiKey || !this.baseUrl) {
      throw new SttUnavailableError("Speech-to-text is not configured. Set STT_API_KEY (or AI_API_KEY) to enable transcription.");
    }

    const dataUri = `data:${input.mimeType || "audio/wav"};base64,${input.buffer.toString("base64")}`;
    if (Buffer.byteLength(dataUri, "utf8") > MAX_BASE64_BYTES) {
      throw new ApiError(413, "Audio is too large for speech-to-text. Please record a shorter response.");
    }

    const body = JSON.stringify({
      model: this.model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "input_audio",
              input_audio: { data: dataUri },
            },
          ],
        },
      ],
      stream: false,
      asr_options: { language: "en", enable_itn: false },
    });

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new ApiError(504, "Speech-to-text timed out. Please retry.");
      }
      console.error("STT request failed", error);
      throw new ApiError(502, "Speech-to-text service is temporarily unavailable");
    }

    if (!response.ok) {
      console.error("STT request failed", response.status, response.statusText);
      if (response.status === 401 || response.status === 403) {
        throw new SttUnavailableError("Speech-to-text credentials are invalid or missing.");
      }
      if (response.status === 400 || response.status === 404 || response.status === 405) {
        throw new SttUnavailableError("Speech-to-text is not enabled for this provider or API key. Enable an ASR model for your API key, or set STT_API_KEY/STT_BASE_URL.");
      }
      throw new ApiError(502, "Speech-to-text service is temporarily unavailable");
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: { content?: string; annotations?: Array<{ language?: string; type?: string }> };
      }>;
      usage?: { seconds?: number };
    };
    const text = (payload.choices?.[0]?.message?.content || "").trim();
    if (!text) throw new ApiError(502, "Speech-to-text returned no transcript");

    const language = payload.choices?.[0]?.message?.annotations?.find((a) => a.type === "audio_info")?.language;
    return {
      text,
      language: language || "en",
      durationSec: typeof payload.usage?.seconds === "number" ? payload.usage.seconds : undefined,
    };
  }
}

/** DashScope caps the base64-encoded input at ~10 MB; stay under it. */
const MAX_BASE64_BYTES = 9.5 * 1024 * 1024;

let providerInstance: SpeechToTextProvider | null = null;

export function getSpeechToTextProvider(): SpeechToTextProvider | null {
  if (!providerInstance) {
    const provider = process.env.STT_PROVIDER === "qwen-asr" ? new QwenAsrSttProvider() : new OpenAICompatibleSttProvider();
    providerInstance = provider.configured() ? provider : null;
  }
  return providerInstance;
}
