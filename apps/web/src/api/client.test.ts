import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, ApiError } from './client';

// Spy on the global fetch to simulate API responses without a running server.

function makeProblemResponse(
  status: number,
  body: object,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/problem+json', ...headers },
  });
}

function makeSuccessResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('buildApiError — validation errors surface real reasons', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the first validation message when errors[] is present', async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeProblemResponse(422, {
        type: 'https://example.com/problems/validation',
        title: 'Unprocessable Entity',
        status: 422,
        errors: [
          { field: 'url', message: 'url must be a valid URL', rule: 'isUrl' },
        ],
      }),
    );

    await expect(
      apiFetch('/api/links', 'post', { body: { url: 'google.com', slug: '' } }),
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof ApiError &&
        err.status === 422 &&
        err.message !== 'Unprocessable Entity' &&
        err.message.includes('url must be a valid URL')
      );
    });
  });

  it('joins multiple validation messages when errors[] has several entries', async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeProblemResponse(422, {
        title: 'Unprocessable Entity',
        status: 422,
        errors: [
          { field: 'url', message: 'url must be a valid URL', rule: 'isUrl' },
          { field: 'url', message: 'url must not be a private address', rule: 'isPublicUrl' },
        ],
      }),
    );

    await expect(
      apiFetch('/api/links', 'post', { body: { url: 'google.com', slug: '' } }),
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof ApiError &&
        err.status === 422 &&
        err.message.includes('url must be a valid URL') &&
        err.message.includes('url must not be a private address')
      );
    });
  });

  it('falls back to detail when errors[] is absent', async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeProblemResponse(422, {
        title: 'Unprocessable Entity',
        detail: 'Slug already taken',
        status: 422,
      }),
    );

    await expect(
      apiFetch('/api/links', 'post', { body: { url: 'https://example.com', slug: 'taken' } }),
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof ApiError &&
        err.status === 422 &&
        err.message === 'Slug already taken'
      );
    });
  });

  it('falls back to title when errors[] is empty and detail is absent', async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeProblemResponse(422, {
        title: 'Unprocessable Entity',
        status: 422,
        errors: [],
      }),
    );

    await expect(
      apiFetch('/api/links', 'post', { body: { url: 'https://example.com', slug: '' } }),
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof ApiError &&
        err.status === 422 &&
        err.message === 'Unprocessable Entity'
      );
    });
  });
});

describe('apiFetch — correlation ID propagation', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends an X-Correlation-ID header with a valid UUID v4 on every request', async () => {
    vi.mocked(fetch).mockResolvedValue(makeSuccessResponse({ links: [] }));

    await apiFetch('/api/links', 'get');

    expect(fetch).toHaveBeenCalledOnce();
    const requestInit = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit;
    const headers = requestInit.headers as Record<string, string>;
    expect(headers['X-Correlation-ID']).toMatch(UUID_V4_RE);
  });

  it('generates a different UUID for each request', async () => {
    // Each call needs its own Response because a Response body can only be read once.
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeSuccessResponse({ links: [] }))
      .mockResolvedValueOnce(makeSuccessResponse({ links: [] }));

    await apiFetch('/api/links', 'get');
    await apiFetch('/api/links', 'get');

    expect(fetch).toHaveBeenCalledTimes(2);
    const firstHeaders = ((fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit)
      .headers as Record<string, string>;
    const secondHeaders = ((fetch as ReturnType<typeof vi.fn>).mock.calls[1]![1] as RequestInit)
      .headers as Record<string, string>;
    expect(firstHeaders['X-Correlation-ID']).not.toBe(secondHeaders['X-Correlation-ID']);
  });
});

describe('ApiError — carries correlation ID from response header', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exposes correlationId when the response includes X-Correlation-ID', async () => {
    const responseCorrelationId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
    vi.mocked(fetch).mockResolvedValue(
      makeProblemResponse(
        404,
        { title: 'Not Found', detail: 'Link not found' },
        { 'X-Correlation-ID': responseCorrelationId },
      ),
    );

    await expect(
      apiFetch('/api/links/not-exist', 'get'),
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof ApiError &&
        err.status === 404 &&
        err.correlationId === responseCorrelationId
      );
    });
  });

  it('leaves correlationId undefined when the response lacks X-Correlation-ID', async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeProblemResponse(500, { title: 'Internal Server Error' }),
    );

    await expect(
      apiFetch('/api/links', 'get'),
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof ApiError &&
        err.status === 500 &&
        err.correlationId === undefined
      );
    });
  });
});
