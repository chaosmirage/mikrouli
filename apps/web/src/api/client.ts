const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const JSON_CONTENT_TYPE = 'application/json';

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function extractErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred';
}

function authorizationHeader(): Record<string, string> {
  const token = getAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

function contentTypeHeader(method: string | undefined): Record<string, string> {
  if (!method || method === 'GET') return {};
  return { 'Content-Type': JSON_CONTENT_TYPE };
}

function buildHeaders(init?: RequestInit): HeadersInit {
  const method = init?.method;
  const existingHeaders = (init?.headers as Record<string, string>) ?? {};
  return { ...authorizationHeader(), ...contentTypeHeader(method), ...existingHeaders };
}

async function buildApiError(response: Response): Promise<ApiError> {
  let message = response.statusText;
  try {
    const body = (await response.json()) as { message?: string };
    if (body.message) message = String(body.message);
  } catch {
    // Keep statusText as message
  }
  return new ApiError(response.status, message);
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = buildHeaders(init);
  const response = await fetch(path, { ...init, headers });
  if (!response.ok) throw await buildApiError(response);
  return response.json() as Promise<T>;
}
