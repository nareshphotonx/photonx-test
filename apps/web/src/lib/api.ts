import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { storage } from './storage';

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = storage.getAccessToken();
  const user = storage.getUser();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  if (user?.tenantId) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>)['x-tenant-id'] = user.tenantId;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = storage.getRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await axios.post(`${API_BASE}/api/auth/refresh`, { refreshToken });
    const data = res.data?.data;
    if (data?.accessToken && data?.refreshToken) {
      storage.setTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      if (!refreshPromise) refreshPromise = refreshAccessToken();
      const newToken = await refreshPromise;
      refreshPromise = null;
      if (newToken) {
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        return api.request(original);
      }
      storage.clear();
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export type ApiEnvelope<T> = {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  requestId: string;
  timestamp: string;
  path: string;
};

export async function get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const res = await api.get<ApiEnvelope<T>>(path, { params });
  return res.data.data;
}

export async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await api.post<ApiEnvelope<T>>(path, body);
  return res.data.data;
}

export async function patch<T>(path: string, body?: unknown): Promise<T> {
  const res = await api.patch<ApiEnvelope<T>>(path, body);
  return res.data.data;
}

export async function del<T>(path: string): Promise<T> {
  const res = await api.delete<ApiEnvelope<T>>(path);
  return res.data.data;
}

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    if (Array.isArray(data?.message)) return data!.message!.join(', ');
    if (typeof data?.message === 'string') return data!.message!;
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}
