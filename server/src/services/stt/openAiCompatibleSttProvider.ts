import { ApiError } from "../../utils/helpers";
import { SttUnavailableError, type SpeechToTextProvider, type Transcript, type TranscriptionInput } from "./speechToTextProvider";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "whisper-1";

/**
 * OpenAI-compatible /audio/transcriptions implementation.
 * Credentials: STT_API_KEY/STT_MODEL/STT_BASE_URL, falling back to the
 * platform's shared AI_* values so a single key can power both.
 */
export class OpenAICompatibleSttProvider implements SpeechToTextProvider {
  readonly name: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options?: { apiKey?: string; baseUrl?: string; model?: string; timeoutMs?: number }) {
    this.apiKey = options?.apiKey || process.env.STT_API_KEY || process.env.AI_API_KEY || "";
    this.baseUrl = (options?.baseUrl || process.env.STT_BASE_URL || process.env.AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
    this.model = options?.model || process.env.STT_MODEL || DEFAULT_MODEL;
    this.timeoutMs = options?.timeoutMs || 120000;
    this.name = `openai-compatible:${this.model}`;
  }

  configured(): boolean {
    return Boolean(this.apiKey);
  }

  async transcribe(input: TranscriptionInput): Promise<Transcript> {
    if (!this.apiKey) {
      throw new SttUnavailableError("Speech-to-text is not configured. Set STT_API_KEY (or AI_API_KEY) to enable transcription.");
    }
    const body = new FormData();
    body.append("file", new Blob([new Uint8Array(input.buffer)], { type: input.mimeType }), input.filename);
    body.append("model", this.model);
    body.append("response_format", "json");
    body.append("language", "en");

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}` },
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
      if (response.status === 404) {
        throw new SttUnavailableError("Speech-to-text is not enabled for this provider or API key. Enable an ASR model for your API key, or set STT_API_KEY/STT_BASE_URL.");
      }
      throw new ApiError(502, "Speech-to-text service is temporarily unavailable");
    }

    const payload = (await response.json()) as {
      text?: string;
      language?: string;
      duration?: number;
      segments?: Array<{ confidence?: number }>;
    };
    const text = (payload.text || "").trim();
    if (!text) throw new ApiError(502, "Speech-to-text returned no transcript");

    let confidence: number | undefined;
    if (Array.isArray(payload.segments) && payload.segments.length > 0) {
      const values = payload.segments.map((s) => Number(s.confidence)).filter((v) => Number.isFinite(v) && v >= 0 && v <= 1);
      if (values.length > 0) confidence = values.reduce((a, b) => a + b, 0) / values.length;
    }

    return {
      text,
      confidence,
      language: payload.language || "en",
      durationSec: typeof payload.duration === "number" ? payload.duration : undefined,
    };
  }
}

let providerInstance: SpeechToTextProvider | null = null;

export function getSpeechToTextProvider(): SpeechToTextProvider | null {
  if (!providerInstance) {
    const candidate = new OpenAICompatibleSttProvider();
    providerInstance = candidate.configured() ? candidate : null;
  }
  return providerInstance;
}