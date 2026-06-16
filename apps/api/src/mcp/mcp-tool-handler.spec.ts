/**
 * Verifies the create_short_link tool handler:
 *   - valid URL -> full link in text content, PublicLink-shaped structuredContent
 *     with shortLink (full URL) and shortUrl (bare slug)
 *   - private-IP URL -> isError validation tool error (SSRF mirror)
 *   - no stack traces in error text
 *   - monthly limit exceeded -> isError result surfacing 429
 */

import { UnprocessableEntityException } from '@nestjs/common';
import { createShortLinkHandler } from './create-short-link.handler';
import { MonthlyLinkLimitExceededError } from '../usage/usage.errors';

const FAKE_USER_ID = 'user-abc';
const FAKE_BASE_URL = 'https://mikrou.li';

// Minimal LinksService stub -- shortUrl is the bare 6-char slug (primary key).
const successResult = {
  shortUrl: 'abcdef',
  originalUrl: 'https://example.com/page',
  createdAt: new Date('2026-06-12T10:00:00Z'),
  expiresAt: new Date('2029-06-12T10:00:00Z'),
};

function makeLinksServiceStub(overrides?: { createShouldThrow?: Error }) {
  return {
    create: jest.fn().mockImplementation(async () => {
      if (overrides?.createShouldThrow) throw overrides.createShouldThrow;
      return successResult;
    }),
  };
}

describe('createShortLinkHandler', () => {
  it('valid URL: text content is the full usable link', async () => {
    const svc = makeLinksServiceStub();
    const handler = createShortLinkHandler(svc as never, FAKE_USER_ID, FAKE_BASE_URL);
    const result = await handler({ url: 'https://example.com/page' });

    expect(result.isError).toBeFalsy();
    expect(result.content[0]?.type).toBe('text');
    const text = (result.content[0] as { type: string; text: string }).text;
    // Text must be the full link, not just the slug
    expect(text).toBe('https://mikrou.li/abcdef');
    expect(text).toMatch(/^https:\/\/mikrou\.li\//);
  });

  it('valid URL: structuredContent has slug in shortUrl and full link in shortLink', async () => {
    const svc = makeLinksServiceStub();
    const handler = createShortLinkHandler(svc as never, FAKE_USER_ID, FAKE_BASE_URL);
    const result = await handler({ url: 'https://example.com/page' });

    expect(result.isError).toBeFalsy();
    const sc = result.structuredContent as Record<string, unknown>;
    // shortUrl is the bare slug (PublicLink contract)
    expect(sc['shortUrl']).toBe('abcdef');
    expect(sc['shortUrl']).toMatch(/^[A-Za-z0-9_]{6}$/);
    // shortLink is the full usable URL
    expect(sc['shortLink']).toBe('https://mikrou.li/abcdef');
    expect(sc['originalUrl']).toBe('https://example.com/page');
    expect(typeof sc['createdAt']).toBe('string');
    expect(typeof sc['expiresAt']).toBe('string');
  });

  it('trailing slash in baseUrl is stripped', async () => {
    const svc = makeLinksServiceStub();
    const handler = createShortLinkHandler(svc as never, FAKE_USER_ID, 'https://mikrou.li/');
    const result = await handler({ url: 'https://example.com/page' });

    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toBe('https://mikrou.li/abcdef');
  });

  it('private-IP URL returns isError validation tool error', async () => {
    const svc = makeLinksServiceStub();
    const handler = createShortLinkHandler(svc as never, FAKE_USER_ID, FAKE_BASE_URL);
    const result = await handler({ url: 'http://192.168.1.1/admin' });

    expect(result.isError).toBe(true);
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toMatch(/422/);
    expect(text).not.toMatch(/at \w/);
    // LinksService.create must NOT have been called (validation gate held)
    expect(svc.create).not.toHaveBeenCalled();
  });

  it('linksService error maps to isError result with no stack trace', async () => {
    const err = new UnprocessableEntityException({ kind: 'validation', errors: [] });
    const svc = makeLinksServiceStub({ createShouldThrow: err });
    const handler = createShortLinkHandler(svc as never, FAKE_USER_ID, FAKE_BASE_URL);
    const result = await handler({ url: 'https://example.com/valid' });

    expect(result.isError).toBe(true);
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).not.toMatch(/at \w/);
  });

  it('monthly link limit exceeded returns isError result surfacing 429', async () => {
    const err = new MonthlyLinkLimitExceededError();
    const svc = makeLinksServiceStub({ createShouldThrow: err });
    const handler = createShortLinkHandler(svc as never, FAKE_USER_ID, FAKE_BASE_URL);
    const result = await handler({ url: 'https://example.com/valid' });

    expect(result.isError).toBe(true);
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toMatch(/429/);
    expect(text).not.toMatch(/at \w/);
  });
});
