import { ApiError } from "./helpers";

export const SPEAKING_AUDIO_MIMES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/webm",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/x-aac",
  "audio/ogg",
]);

export type AudioFormat = "wav" | "webm" | "mp3" | "m4a" | "aac" | "ogg";

export function detectAudioFormat(buffer: Buffer): AudioFormat | null {
  if (!buffer || buffer.length < 4) return null;
  const prefix = buffer.subarray(0, 4).toString("hex");
  if (prefix === "1a45dfa3") return "webm";
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WAVE") return "wav";
  if (buffer.length >= 3 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) return "mp3";
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return "mp3";
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") return "m4a";
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xf6) === 0xf0) return "aac";
  if (buffer.toString("ascii", 0, 4) === "OggS") return "ogg";
  return null;
}

export function formatMatchesMime(format: AudioFormat, mimeType: string): boolean {
  // The declared MIME type must agree with the detected file signature.
  switch (format) {
    case "wav":
      return mimeType === "audio/wav" || mimeType === "audio/x-wav" || mimeType === "audio/wave";
    case "webm":
      return mimeType === "audio/webm";
    case "mp3":
      return mimeType === "audio/mpeg" || mimeType === "audio/mp3";
    case "m4a":
      return mimeType === "audio/mp4" || mimeType === "audio/m4a" || mimeType === "audio/x-m4a";
    case "aac":
      return mimeType === "audio/aac" || mimeType === "audio/x-aac";
    case "ogg":
      return mimeType === "audio/ogg";
    default:
      return false;
  }
}

// --- Duration extraction (server-side, independent of the client report) ---

export function parseWavDuration(buffer: Buffer): number | null {
  // RIFF header: "RIFF" size "WAVE"; fmt chunk: format(2) channels(2) sampleRate(4) byteRate(4) blockAlign(2) bits(2); data chunk size.
  if (!buffer || buffer.length < 44) return null;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    if (chunkId === "fmt ") {
      if (offset + 20 > buffer.length) return null;
      const byteRate = buffer.readUInt32LE(offset + 16);
      if (!byteRate) return null;
      const dataChunk = findWavChunk(buffer, "data", offset + 8 + chunkSize);
      if (!dataChunk) return null;
      return dataChunk.size / byteRate;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  return null;
}

function findWavChunk(buffer: Buffer, id: string, start: number): { size: number } | null {
  let offset = start;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    if (chunkId === id) return { size: chunkSize };
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  return null;
}

// --- Minimal EBML reader for WebM/Matroska duration ---

function markerLength(first: number): number {
  let mask = 0x80;
  let length = 1;
  while (mask && !(first & mask)) {
    mask >>= 1;
    length += 1;
  }
  return mask === 0 ? 0 : length;
}

// EBML element IDs keep their raw bytes (marker bit included).
function readEbmlId(buffer: Buffer, offset: number): { value: number; length: number } | null {
  if (offset >= buffer.length) return null;
  const length = markerLength(buffer[offset]);
  if (length === 0 || offset + length > buffer.length) return null;
  let value = 0;
  for (let i = 0; i < length; i++) value = value * 256 + buffer[offset + i];
  return { value, length };
}

// EBML sizes strip the marker bit.
function readEbmlSize(buffer: Buffer, offset: number): { value: number; length: number } | null {
  if (offset >= buffer.length) return null;
  const first = buffer[offset];
  const length = markerLength(first);
  if (length === 0 || offset + length > buffer.length) return null;
  const mask = 0x80 >> (length - 1);
  let value = first & (mask - 1);
  for (let i = 1; i < length; i++) value = value * 256 + buffer[offset + i];
  return { value, length };
}

function readEbmlElement(buffer: Buffer, offset: number): { id: number; size: number; dataStart: number; next: number } | null {
  const id = readEbmlId(buffer, offset);
  if (!id) return null;
  const size = readEbmlSize(buffer, offset + id.length);
  if (!size) return null;
  const dataStart = offset + id.length + size.length;
  const declaredEnd = dataStart + size.value;
  return {
    id: id.value,
    size: size.value,
    dataStart,
    next: declaredEnd > buffer.length ? buffer.length : declaredEnd,
  };
}

const EBML_DURATION = 0x4489;
const EBML_TIMECODE_SCALE = 0x2ad7b1;
const EBML_SEGMENT = 0x18538067;
const EBML_HEADER = 0x1a45dfa3;
const EBML_INFO = 0x1549a966;

export function parseWebmDuration(buffer: Buffer): number | null {
  if (!buffer) return null;
  // Top-level structure: EBML header element (0x1A45DFA3), then Segment.
  let offset = 0;
  const header = readEbmlElement(buffer, offset);
  if (!header) return null;
  if (header.id === EBML_HEADER) offset = header.next;
  const segment = readEbmlElement(buffer, offset);
  if (!segment || segment.id !== EBML_SEGMENT) return null;
  offset = segment.dataStart;

  let timecodeScale = 1000000; // ns per tick, 1ms default
  let duration: number | null = null;

  while (offset + 4 <= buffer.length) {
    const element = readEbmlElement(buffer, offset);
    if (!element) break;
    offset = element.next;
    if (element.id === EBML_INFO) {
      let infoOffset = element.dataStart;
      while (infoOffset + 4 <= element.dataStart + element.size) {
        const infoElement = readEbmlElement(buffer, infoOffset);
        if (!infoElement) break;
        infoOffset = infoElement.next;
        if (infoElement.id === EBML_DURATION && infoElement.dataStart + 8 <= buffer.length) {
          // Float elements store width in their size: 4 or 8 bytes.
          const width = infoElement.size;
          if (width === 8) duration = buffer.readDoubleBE(infoElement.dataStart);
          else if (width === 4) duration = buffer.readFloatBE(infoElement.dataStart);
        } else if (infoElement.id === EBML_TIMECODE_SCALE && infoElement.size >= 1 && infoElement.size <= 8) {
          timecodeScale =
            infoElement.size === 8
              ? Number(buffer.readBigUInt64BE(infoElement.dataStart))
              : Number(buffer.readUIntBE(infoElement.dataStart, infoElement.size));
          if (timecodeScale === 0) timecodeScale = 1000000;
        }
      }
      if (duration !== null) {
        // Both Chrome's MediaRecorder and ffmpeg write the duration in timecode
        // ticks (ms at the default 1 ms scale), so ticks*scale/1e9 yields seconds.
        return (duration * timecodeScale) / 1e9;
      }
    }
  }
  return null;
}

export function decodeAudioDuration(buffer: Buffer, format: AudioFormat): number | null {
  if (format === "wav") return parseWavDuration(buffer);
  if (format === "webm") return parseWebmDuration(buffer);
  return null;
}

export interface ValidatedAudio {
  mimeType: string;
  format: AudioFormat;
  sizeBytes: number;
  durationSec: number;
}

export interface AudioValidationOptions {
  maxDurationSec: number;
  minDurationSec: number;
  maxSizeBytes: number;
}

/**
 * Validates an uploaded speaking attempt's audio without trusting the
 * filename or the browser-supplied MIME type:
 *  1. size cap
 *  2. MIME allow-list
 *  3. magic-byte signature detection + MIME agreement
 *  4. duration bounds — parsed from the container when possible, otherwise
 *     the client-reported duration is used with clamping checks.
 */
export function validateSpeakingAudio(
  buffer: Buffer,
  declaredMime: string,
  reportedDurationSec: number,
  options: AudioValidationOptions,
): ValidatedAudio {
  if (!buffer || buffer.length === 0) throw new ApiError(400, "No audio provided");
  if (buffer.length > options.maxSizeBytes) {
    throw new ApiError(400, `Audio is too large. Maximum size is ${Math.round(options.maxSizeBytes / 1024 / 1024)} MB.`);
  }
  const normalizedMime = declaredMime.toLowerCase().split(";")[0].trim();
  if (!SPEAKING_AUDIO_MIMES.has(normalizedMime)) {
    throw new ApiError(400, `Unsupported audio type: ${declaredMime || "unknown"}`);
  }
  const format = detectAudioFormat(buffer);
  if (!format) {
    throw new ApiError(400, "Uploaded file is not a recognised audio file. Use WAV, WebM, MP3, M4A, AAC or OGG.");
  }
  if (!formatMatchesMime(format, normalizedMime)) {
    throw new ApiError(400, `File signature does not match its declared type (expected ${normalizedMime}, detected ${format}). The file may be renamed or corrupted.`);
  }

  const parsedDuration = decodeAudioDuration(buffer, format);
  let durationSec: number;

  if (parsedDuration !== null) {
    // Trust the container parse over any client-reported timer.
    durationSec = parsedDuration;
  } else {
    // Container not parseable (e.g. MP3): fall back to the client report,
    // but reject claims that cannot fit in the file size at a plausible
    // maximum bitrate (40 KB/s ≈ 320 kbps).
    durationSec = Math.max(0, Math.floor(reportedDurationSec || 0));
    const maxPossibleSec = buffer.length / (40 * 1024) + 5;
    if (durationSec > maxPossibleSec) {
      throw new ApiError(400, "Reported recording duration is not consistent with the audio file.");
    }
  }
  if (durationSec < options.minDurationSec) {
    throw new ApiError(400, `Recording is too short. Minimum ${options.minDurationSec} seconds of audio is required.`);
  }
  if (durationSec > options.maxDurationSec) {
    throw new ApiError(400, `Recording is too long. Maximum ${options.maxDurationSec} seconds of audio is allowed.`);
  }

  return { mimeType: normalizedMime, format, sizeBytes: buffer.length, durationSec: Math.round(durationSec) };
}