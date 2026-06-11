import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, ApiError } from './client';

// Spy on the global fetch to simulate API responses without a running server.

function makeProblemResponse(
  status: number,
  body: object,
  contentType = 'application/problem+json',
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': contentType },
  });
}

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
