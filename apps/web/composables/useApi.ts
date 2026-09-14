import { ofetch } from 'ofetch';
import type { FetchOptions } from 'ofetch';

interface ApiError {
  statusCode: number;
  message: string | string[];
}

type JsonFetchOptions = FetchOptions<'json'>;
type RequestBody = JsonFetchOptions['body'];

export function useApi() {
  const config = useRuntimeConfig();
  const auth = useAuthStore();

  const request = ofetch.create({
    baseURL: config.public.apiBase as string,
    timeout: 8000,
    onRequest({ options }) {
      if (auth.token) {
        const headers = new Headers(options.headers);
        headers.set('Authorization', `Bearer ${auth.token}`);
        options.headers = headers;
      }
    },
    onResponseError({ response }) {
      if (response.status === 401 && auth.token) {
        if (auth.assumptionProfile) auth.endAssumption();
        else auth.clear();
      }
    },
  });

  return {
    async get<T>(url: string, query?: Record<string, unknown>, options: JsonFetchOptions = {}): Promise<T> {
      return request<T>(url, { ...options, query });
    },
    async getBlob(url: string): Promise<Blob> {
      return request<Blob, 'blob'>(url, { responseType: 'blob' });
    },
    async post<T>(url: string, body?: RequestBody, options: JsonFetchOptions = {}): Promise<T> {
      return request<T>(url, { ...options, method: 'POST', body });
    },
    async put<T>(url: string, body?: RequestBody, options: JsonFetchOptions = {}): Promise<T> {
      return request<T>(url, { ...options, method: 'PUT', body });
    },
    async patch<T>(url: string, body?: RequestBody, options: JsonFetchOptions = {}): Promise<T> {
      return request<T>(url, { ...options, method: 'PATCH', body });
    },
    async delete<T>(url: string, options: JsonFetchOptions = {}): Promise<T> {
      return request<T>(url, { ...options, method: 'DELETE' });
    },
  };
}

export function errorMessage(e: unknown): string {
  const err = e as { data?: ApiError; message?: string };
  const msg = err?.data?.message ?? err?.message;
  if (Array.isArray(msg)) return msg.join('；');
  if (msg) return msg;
  return '發生未知錯誤';
}
