import api, { apiGet, apiPost, type ApiResponse, type PageMeta } from "./client";
import type { SpeakingAttemptDetail, SpeakingAttemptSummary, SpeakingProgress, SpeakingTaskType } from "@testora-platform/shared";

export interface CreateSpeakingAttemptInput {
  taskType: SpeakingTaskType;
  title: string;
  prompt: string;
  durationSec: number;
  file: File;
  keepAudio?: boolean;
}

export const speakingApi = {
  createAttempt: async (input: CreateSpeakingAttemptInput, onProgress?: (percent: number) => void): Promise<SpeakingAttemptSummary> => {
    const form = new FormData();
    form.append("file", input.file);
    form.append("taskType", input.taskType);
    form.append("title", input.title);
    form.append("prompt", input.prompt);
    form.append("durationSec", String(Math.round(input.durationSec)));
    form.append("keepAudio", String(Boolean(input.keepAudio)));
    const { data } = await api.post<ApiResponse<SpeakingAttemptSummary>>("/speaking/attempts", form, {
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
      headers: { "Content-Type": "multipart/form-data" },
    });
    if (!data.success || !data.data) throw new Error(data.message || "Upload failed");
    return data.data;
  },

  listAttempts: async (page = 1, limit = 10): Promise<{ data: SpeakingAttemptSummary[]; pagination?: PageMeta }> => {
    const response = await apiGet<SpeakingAttemptSummary[]>("/speaking/attempts", { page, limit });
    return { data: response.data ?? [], pagination: response.pagination };
  },

  getAttempt: async (attemptId: string): Promise<SpeakingAttemptDetail> => {
    const response = await apiGet<SpeakingAttemptDetail>(`/speaking/attempts/${attemptId}`);
    if (!response.data) throw new Error(response.message || "Could not load the speaking attempt");
    return response.data;
  },

  retryAttempt: async (attemptId: string): Promise<SpeakingAttemptSummary> => {
    const response = await apiPost<SpeakingAttemptSummary>(`/speaking/attempts/${attemptId}/retry`);
    if (!response.data) throw new Error(response.message || "Retry failed");
    return response.data;
  },

  getProgress: async (): Promise<SpeakingProgress> => {
    const response = await apiGet<SpeakingProgress>("/speaking/attempts/progress");
    if (!response.data) throw new Error(response.message || "Could not load speaking progress");
    return response.data;
  },
};

export async function waitForSpeakingResult(attemptId: string, onStatus?: (status: "PROCESSING" | "COMPLETED" | "FAILED") => void, timeoutMs = 5 * 60 * 1000): Promise<SpeakingAttemptDetail> {
  const deadline = Date.now() + timeoutMs;
  let attempt = await speakingApi.getAttempt(attemptId);
  onStatus?.(attempt.status);
  while (attempt.status === "PROCESSING" && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    attempt = await speakingApi.getAttempt(attemptId);
    onStatus?.(attempt.status);
  }
  return attempt;
}