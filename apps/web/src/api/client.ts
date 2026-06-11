import type { paths } from './openapi-generated';

const JSON_CONTENT_TYPE = 'application/json';

// Path-keyed type helpers (module-scope, depth 0)
type ApiPath = keyof paths;
type HttpMethod<P extends ApiPath> = keyof paths[P] & string;

type RequestBody<P extends ApiPath, M extends HttpMethod<P>> = paths[P][M] extends {
  requestBody: { content: { 'application/json': infer B } };
}
  ? B
  : never;

type JsonBody<P extends ApiPath, M extends HttpMethod<P>> =
  RequestBody<P, M> extends never ? undefined : RequestBody<P, M>;

type Ok200<P extends ApiPath, M extends HttpMethod<P>> = paths[P][M] extends {
  responses: { 200: { content: { 'application/json': infer T } } };
}
  ? T
  : never;

type Ok201<P extends ApiPath, M extends HttpMethod<P>> = paths[P][M] extends {
  responses: { 201: { content: { 'application/json': infer T } } };
}
  ? T
  : never;

type SuccessBody<P extends ApiPath, M extends HttpMethod<P>> =
  Ok200<P, M> extends never ? (Ok201<P, M> extends never ? void : Ok201<P, M>) : Ok200<P, M>;

interface ValidationError {
  field: string;
  message: string;
  rule: string;
}

interface ProblemDetails {
  type?: string;
  title?: string;
  detail?: string;
  message?: string;
  errors?: ValidationError[];
}

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

export function extractErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred';
}

function buildFetchHeaders(method: string, hasBody: boolean): Record<string, string> {
  if (!hasBody || method === 'GET') return {};
  return { 'Content-Type': JSON_CONTENT_TYPE };
}

// Joins validation error messages into a single human-readable string so the
// UI shows the actual reason (e.g. "url must be a valid URL") rather than the
// generic RFC 9457 title ("Unprocessable Entity").
function composeValidationMessage(errors: ValidationError[]): string {
  return errors.map((e) => e.message).join('; ');
}

async function buildApiError(response: Response): Promise<ApiError> {
  let message = response.statusText;
  let problemType: string | undefined;
  try {
    const body = (await response.json()) as ProblemDetails;
    if (body.errors && body.errors.length > 0) {
      message = composeValidationMessage(body.errors);
    } else {
      message = body.detail ?? body.title ?? body.message ?? response.statusText;
    }
    problemType = body.type;
  } catch {
    // Keep statusText as message
  }
  return new ApiError(response.status, message, problemType);
}

function resolvePathParams(path: string, params: Record<string, string>): string {
  return Object.entries(params).reduce(
    (acc, [k, v]) => acc.replace(`{${k}}`, encodeURIComponent(v)),
    path,
  );
}

export async function apiFetch<P extends ApiPath, M extends HttpMethod<P>>(
  path: P,
  method: M,
  opts?: { body?: JsonBody<P, M>; pathParams?: Record<string, string> },
): Promise<SuccessBody<P, M>> {
  const resolvedPath = opts?.pathParams
    ? resolvePathParams(path as string, opts.pathParams)
    : (path as string);
  const hasBody = opts?.body !== undefined;
  const headers = buildFetchHeaders(method.toUpperCase(), hasBody);
  const body = hasBody ? JSON.stringify(opts?.body) : undefined;
  // credentials: 'include' sends HttpOnly session cookies on every same-origin
  // request. No script-readable token storage is used.
  const response = await fetch(resolvedPath, {
    method: method.toUpperCase(),
    headers,
    body,
    credentials: 'include',
  });
  if (!response.ok) throw await buildApiError(response);
  if (response.status === 204) return undefined as SuccessBody<P, M>;
  return response.json() as Promise<SuccessBody<P, M>>;
}
