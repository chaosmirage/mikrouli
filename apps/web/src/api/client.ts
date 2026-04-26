const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const JSON_CONTENT_TYPE = 'application/json';

interface ProblemDetails {
  type?: string;
  title?: string;
  detail?: string;
  message?: string;
}

const PROBLEM_TYPE_I18N_MAP: Record<string, string> = {
  validation: 'errors:validation',
  unauthorized: 'errors:unauthorized',
  conflict: 'errors:conflict',
  'not-found': 'errors:notFound',
  forbidden: 'errors:forbidden',
};

export class ApiError extends Error {
  readonly status: number;
  readonly problemType?: string;
  constructor(status: number, message: string, problemType?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.problemType = problemType;
  }
}

export function mapProblemTypeToI18nKey(problemType: string | undefined): string {
  if (!problemType) return 'errors:generic';
  const parts = problemType.split('/');
  const segment = parts[parts.length - 1] ?? problemType;
  return PROBLEM_TYPE_I18N_MAP[segment] ?? 'errors:generic';
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
  let problemType: string | undefined;
  try {
    const body = (await response.json()) as ProblemDetails;
    message = body.detail ?? body.title ?? body.message ?? response.statusText;
    problemType = body.type;
  } catch {
    // Keep statusText as message
  }
  return new ApiError(response.status, message, problemType);
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = buildHeaders(init);
  const response = await fetch(path, { ...init, headers });
  if (!response.ok) throw await buildApiError(response);
  return response.json() as Promise<T>;
}
