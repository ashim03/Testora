import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../store/auth";

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ApiResult<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  pagination?: PageMeta;
  unread?: number;
}

export type ApiResponse<T = unknown> = ApiResult<T>;

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string) || "/api",
  withCredentials: true,
});

let refreshPromise: Promise<string | null> | null = null;

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse>) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && original && !original._retry && !original.url?.includes("/auth/")) {
      original._retry = true;
      try {
        const token = await refreshToken();
        if (token) {
          useAuthStore.getState().setAccessToken(token);
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        }
      } catch {
        useAuthStore.getState().logout();
      }
    }
    return Promise.reject(error);
  },
);

export async function refreshToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = api
      .post<ApiResponse<{ accessToken: string }>>("/auth/refresh")
      .then((r) => r.data.data?.accessToken ?? null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export const apiGet = async <T>(url: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> => {
  const { data } = await api.get<ApiResponse<T>>(url, { params });
  return data;
};

export const apiPost = async <T>(url: string, body?: unknown): Promise<ApiResponse<T>> => {
  const { data } = await api.post<ApiResponse<T>>(url, body);
  return data;
};

export const apiPatch = async <T>(url: string, body?: unknown): Promise<ApiResponse<T>> => {
  const { data } = await api.patch<ApiResponse<T>>(url, body);
  return data;
};

export const apiPut = async <T>(url: string, body?: unknown): Promise<ApiResponse<T>> => {
  const { data } = await api.put<ApiResponse<T>>(url, body);
  return data;
};

export const apiDelete = async <T>(url: string): Promise<ApiResponse<T>> => {
  const { data } = await api.delete<ApiResponse<T>>(url);
  return data;
};

export interface UploadResult {
  url?: string;
  publicId?: string;
  provider?: string;
  assetId?: string;
}

export async function uploadFile(
  file: File,
  kind: string,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  const { data } = await api.post<ApiResponse<UploadResult>>(`/media/upload?kind=${encodeURIComponent(kind)}`, form, {
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
    headers: { "Content-Type": "multipart/form-data" },
  });
  if (!data.success || !data.data?.url) throw new Error(data.message || "Upload failed");
  return data.data;
}

export async function listAudioFiles(): Promise<Array<{
  assetId: string;
  url: string;
  mimeType: string;
  size: number;
  provider?: string;
  createdAt?: string;
}>> {
  const { data } = await api.get<ApiResponse<Array<{
    assetId: string;
    url: string;
    mimeType: string;
    size: number;
    provider?: string;
    createdAt?: string;
  }>>>("/media/audio");
  return data.data ?? [];
}

export async function deleteAudioFile(assetId: string): Promise<void> {
  await api.delete<ApiResponse>(`/media/audio/${assetId}`);
}

export async function fetchAuthBlob(url: string): Promise<Blob> {
  const { data } = await api.get<Blob>(url, { responseType: "blob" });
  return data;
}

export default api;