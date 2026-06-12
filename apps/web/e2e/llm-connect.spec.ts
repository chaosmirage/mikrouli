/**
 * End-to-end verification that the LLM agent guidance is truthful on the
 * production-shaped stack (nginx on :8888). Requires `docker compose up`
 * before running.
 *
 * Steps tested:
 *   (a) /llms.txt is reachable and contains the required literals
 *   (b) /connect raw HTML (no JS) carries the instructions and meta tags
 *   (c) Follow the guide verbatim: mint a key, call POST /api/urls, verify the
 *       short link resolves; without a key -> 401 application/problem+json
 *   (d) POST /api/mcp with initialize + tools/call -> result with full link;
 *       without key -> 401 problem-details
 *   (e) sitemap.xml lists /connect; robots.txt does not disallow /connect
 */

import { test, expect } from './fixtures';

const MCP_INIT_PAYLOAD = {
  jsonrpc: '2.0',
  method: 'initialize',
  id: 1,
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'e2e-test', version: '1' },
  },
};

test.describe('llms.txt machine guide', () => {
  test('GET /llms.txt returns 200 with required literals', async ({ request }) => {
    const res = await request.get('/llms.txt');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain('x-api-key');
    expect(text).toContain('/api/urls');
    expect(text).toContain('mk_');
    expect(text).toContain('/api/mcp');
  });

  test('GET /llms.txt contains the claude mcp add command', async ({ request }) => {
    const res = await request.get('/llms.txt');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain('claude mcp add');
    expect(text).toContain('https://mikrou.li/api/mcp');
    expect(text).toContain('--header');
    expect(text).toContain('x-api-key');
  });

  test('GET /llms.txt contains explicit API key acquisition instructions', async ({ request }) => {
    const res = await request.get('/llms.txt');
    expect(res.status()).toBe(200);
    const text = await res.text();
    // Must have a prominent step instructing how to get a key
    expect(text.toLowerCase()).toMatch(/sign.?in/);
    expect(text).toContain('API Keys');
  });
});

test.describe('/connect page', () => {
  test('raw body contains instructions and title/description meta', async ({ request }) => {
    const res = await request.get('/connect');
    expect(res.status()).toBe(200);
    const html = await res.text();
    // Page-specific meta must be present in the prerendered HTML
    expect(html).toMatch(/<title[^>]*>.*mikrouli.*<\/title>/i);
    expect(html).toMatch(/<meta[^>]*description[^>]*>/i);
    // The canonical should point to /connect
    expect(html).toContain('/connect');
    // Prerendered HTML must carry the key integration literals
    expect(html).toContain('x-api-key');
    expect(html).toContain('/api/urls');
    expect(html).toContain('/api/mcp');
  });

  test('raw body contains the claude mcp add command', async ({ request }) => {
    const res = await request.get('/connect');
    expect(res.status()).toBe(200);
    const html = await res.text();
    // The exact verified Claude Code wiring command must appear in the prerendered body
    expect(html).toContain('claude mcp add');
    expect(html).toContain('https://mikrou.li/api/mcp');
    expect(html).toContain('--transport http');
    expect(html).toContain('x-api-key');
  });

  test('raw body contains the get-API-key prerequisite step', async ({ request }) => {
    const res = await request.get('/connect');
    expect(res.status()).toBe(200);
    const html = await res.text();
    // The API key prerequisite section must be present in the static body
    expect(html).toContain('data-testid="connect-apikey-section"');
    expect(html.toLowerCase()).toMatch(/sign.?in|api.?key/);
  });
});

test.describe('guide execution: REST path', () => {
  test('POST /api/urls without key returns 401 application/problem+json', async ({
    unauthRequest,
  }) => {
    const res = await unauthRequest.fetch('/api/urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: { url: 'https://example.com/test-no-key' },
    });
    expect(res.status()).toBe(401);
    expect(res.headers()['content-type']).toMatch(/application\/problem\+json/);
    const body = await res.json();
    expect(body).toMatchObject({ status: 401 });
  });

  test('mint key, POST /api/urls with key -> 201 + shortUrl is a slug, link resolves', async ({
    page,
    api,
    unauthRequest,
  }) => {
    // Mint a key via the authenticated session (following the guide's prerequisite)
    const keyResp = await api.call('POST', '/api/api-keys', {
      data: { label: 'e2e-guide-test' },
    });
    expect(keyResp.status()).toBe(201);
    const keyBody = (await keyResp.json()) as { key: string };
    const mintedKey = keyBody.key;
    expect(mintedKey).toMatch(/^mk_/);

    // Use the key exactly as the guide instructs
    const linkResp = await unauthRequest.fetch('/api/urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': mintedKey },
      data: { url: 'https://example.com/guide-test' },
    });
    expect(linkResp.status()).toBe(201);
    const linkBody = (await linkResp.json()) as { shortUrl: string };

    // shortUrl is a bare 6-character slug, NOT a full URL
    expect(linkBody.shortUrl).toMatch(/^[A-Za-z0-9_]{6}$/);

    // Build the shareable link by prepending the base URL (as the guide instructs)
    const slug = linkBody.shortUrl;
    const redirectResp = await unauthRequest.fetch(`/api/${slug}`, {
      maxRedirects: 0,
    });
    expect([301, 302]).toContain(redirectResp.status());
    void page; // fixture consumed to ensure auth state
  });
});

test.describe('guide execution: MCP path', () => {
  test('POST /api/mcp without key returns 401 problem-details', async ({ unauthRequest }) => {
    const res = await unauthRequest.fetch('/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: MCP_INIT_PAYLOAD,
    });
    expect(res.status()).toBe(401);
    expect(res.headers()['content-type']).toMatch(/application\/problem\+json/);
  });

  test('POST /api/mcp initialize with valid key returns 200', async ({ api, unauthRequest }) => {
    const keyResp = await api.call('POST', '/api/api-keys', {
      data: { label: 'e2e-mcp-test' },
    });
    expect(keyResp.status()).toBe(201);
    const keyBody = (await keyResp.json()) as { key: string };

    const initResp = await unauthRequest.fetch('/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'x-api-key': keyBody.key,
      },
      data: MCP_INIT_PAYLOAD,
    });
    expect(initResp.status()).toBe(200);
    const body = await initResp.json();
    expect(body).toMatchObject({ jsonrpc: '2.0' });
  });

  test('create_short_link via MCP tools/call returns full usable link', async ({
    api,
    unauthRequest,
  }) => {
    const keyResp = await api.call('POST', '/api/api-keys', {
      data: { label: 'e2e-mcp-create' },
    });
    const keyBody = (await keyResp.json()) as { key: string };

    // Initialize the MCP session first
    await unauthRequest.fetch('/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'x-api-key': keyBody.key,
      },
      data: MCP_INIT_PAYLOAD,
    });

    const callPayload = {
      jsonrpc: '2.0',
      method: 'tools/call',
      id: 2,
      params: {
        name: 'create_short_link',
        arguments: { url: 'https://example.com/mcp-test' },
      },
    };

    const res = await unauthRequest.fetch('/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'x-api-key': keyBody.key,
      },
      data: callPayload,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const resultContent = body?.result?.content as Array<{ type: string; text: string }>;
    expect(resultContent).toBeDefined();

    // Text output must be the FULL usable link (base + "/" + slug)
    const text = resultContent[0]?.text ?? '';
    expect(text).toMatch(/^https:\/\/mikrou\.li\/[A-Za-z0-9_]{6}$/);

    // structuredContent must separate slug (shortUrl) from full link (shortLink)
    const sc = body?.result?.structuredContent as Record<string, string | null> | undefined;
    if (sc) {
      // shortUrl is the bare slug
      expect(sc['shortUrl']).toMatch(/^[A-Za-z0-9_]{6}$/);
      // shortLink is the full usable URL
      expect(sc['shortLink']).toMatch(/^https:\/\/mikrou\.li\//);
    }
  });
});

test.describe('discovery artifacts', () => {
  test('sitemap.xml lists /connect', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    const xml = await res.text();
    expect(xml).toContain('https://mikrou.li/connect');
  });

  test('robots.txt does not disallow /connect', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const txt = await res.text();
    // Must not have a Disallow: /connect line
    expect(txt).not.toMatch(/Disallow:\s*\/connect/);
  });

  test('robots.txt references /llms.txt', async ({ request }) => {
    const res = await request.get('/robots.txt');
    const txt = await res.text();
    expect(txt).toContain('llms.txt');
  });
});
