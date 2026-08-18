import { spawn } from "child_process";
import type { AudioFormat } from "./audioValidation";

export interface AudioPauseAnalysis {
  durationSec: number;
  pauses: Array<{ start: number; end: number; duration: number }>;
  pauseCount: number;
  totalSilenceSec: number;
  speakingSec: number;
  pauseFrequencyPerMinute: number;
  estimated: boolean;
}

export interface ParsedSilence {
  start: number;
  end: number;
  duration: number;
}

const SILENCE_THRESHOLD_DB = -35;
const MIN_PAUSE_SEC = 0.5;

/**
 * Parses ffmpeg silencedetect stderr output into pause segments.
 * Lines look like: [silencedetect @ 0x...] silence_start: 1.234
 *                  [silencedetect @ 0x...] silence_end: 2.567 | silence_duration: 1.333
 */
export function parseSilenceOutput(output: string): ParsedSilence[] {
  const starts: number[] = [];
  const pauses: ParsedSilence[] = [];
  const reStart = /silence_start:\s*(-?[\d.]+)/g;
  const reEnd = /silence_end:\s*(-?[\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = reStart.exec(output)) !== null) starts.push(Number(m[1]));
  while ((m = reEnd.exec(output)) !== null) {
    const end = Number(m[1]);
    const duration = Number(m[2]);
    const start = starts.length > 0 && starts[0] <= end ? starts.shift() as number : Math.max(0, end - duration);
    if (duration >= MIN_PAUSE_SEC) pauses.push({ start, end, duration });
  }
  return pauses;
}

/**
 * Measures real pauses and speaking time from the audio with ffmpeg's
 * silencedetect filter. Falls back to null (callers keep their duration-based
 * estimate) when ffmpeg is missing or decoding fails.
 */
export function analyzeAudioPauses(buffer: Buffer, format: AudioFormat, fallbackDurationSec?: number): Promise<AudioPauseAnalysis | null> {
  return new Promise((resolve) => {
    let stderr = "";
    const args = ["-hide_banner", "-nostats", "-i", "pipe:0", "-ac", "1", "-ar", "16000", "-af", `silencedetect=noise=${SILENCE_THRESHOLD_DB}dB:d=${MIN_PAUSE_SEC}`, "-f", "null", "-"];
    const proc = spawn("ffmpeg", args, { stdio: ["pipe", "ignore", "pipe"] });
    const timer = setTimeout(() => { proc.kill("SIGKILL"); }, 45000);
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on("error", () => resolve(null));
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve(null);
        return;
      }
      const pauses = parseSilenceOutput(stderr);
      const durationMatch = stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
      const durationSec = durationMatch
        ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])
        : fallbackDurationSec ?? 0;
      const totalSilenceSec = pauses.reduce((sum, p) => sum + p.duration, 0);
      const speakingSec = Math.max(0, durationSec - totalSilenceSec);
      const minutes = Math.max(durationSec, 1) / 60;
      resolve({
        durationSec,
        pauses,
        pauseCount: pauses.length,
        totalSilenceSec,
        speakingSec,
        pauseFrequencyPerMinute: Math.round((pauses.length / minutes) * 10) / 10,
        estimated: false,
      });
    });
    proc.stdin.on("error", () => { /* EPIPE when ffmpeg exits early */ });
    proc.stdin.write(buffer);
    proc.stdin.end();
  });
}
