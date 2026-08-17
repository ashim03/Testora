/**
 * Provider abstraction for speech-to-text.
 *
 * Swapping providers (Whisper, Deepgram, Google STT, ...) only requires a new
 * implementation of SpeechToTextProvider — the pipeline never touches provider
 * specifics.
 */
export interface Transcript {
  text: string;
  confidence?: number;
  language?: string;
  durationSec?: number;
}

export interface TranscriptionInput {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}

export interface SpeechToTextProvider {
  readonly name: string;
  transcribe(input: TranscriptionInput): Promise<Transcript>;
}

export class SttUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SttUnavailableError";
  }
}