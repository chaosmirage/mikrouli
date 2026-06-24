import { http, HttpResponse } from 'msw';

// Seed fixtures for Storybook. Every endpoint the SPA calls via apiFetch or
// raw fetch has a matching handler here so stories render with realistic data
// without a live backend.

const MOCK_USER = {
  id: 'usr_001',
  email: 'demo@mikrou.li',
  createdAt: '2026-01-15T10:30:00.000Z',
};

const MOCK_LINKS = [
  {
    shortUrl: 'abc123',
    originalUrl: 'https://github.com/mikrouli/mikrouli',
    createdAt: '2026-06-01T12:00:00.000Z',
    expiresAt: null,
  },
  {
    shortUrl: 'def456',
    originalUrl: 'https://docs.mikrou.li/api-guide',
    createdAt: '2026-06-10T09:15:00.000Z',
    expiresAt: '2026-12-31T23:59:59.000Z',
  },
  {
    shortUrl: 'ghi789',
    originalUrl: 'https://blog.mikrou.li/click-analytics',
    createdAt: '2026-06-15T14:22:00.000Z',
    expiresAt: null,
  },
];

const MOCK_API_KEYS = [
  {
    id: 'key_001',
    label: 'Production CI/CD',
    keyPrefix: 'mk_a1b2',
    createdAt: '2026-02-01T08:00:00.000Z',
    lastUsedAt: '2026-06-20T16:45:00.000Z',
    revokedAt: null,
  },
  {
    id: 'key_002',
    label: 'Development',
    keyPrefix: 'mk_c3d4',
    createdAt: '2026-03-10T11:30:00.000Z',
    lastUsedAt: null,
    revokedAt: '2026-05-01T10:00:00.000Z',
  },
  {
    id: 'key_003',
    label: 'Local Testing',
    keyPrefix: 'mk_e5f6',
    createdAt: '2026-04-15T14:00:00.000Z',
    lastUsedAt: '2026-06-22T09:30:00.000Z',
    revokedAt: null,
  },
];

const MOCK_STATS = {
  slug: 'abc123',
  totalClicks: 1284,
  byDay: [
    { period: '2026-06-18', clicks: 45 },
    { period: '2026-06-19', clicks: 62 },
    { period: '2026-06-20', clicks: 78 },
    { period: '2026-06-21', clicks: 51 },
    { period: '2026-06-22', clicks: 93 },
    { period: '2026-06-23', clicks: 67 },
    { period: '2026-06-24', clicks: 34 },
  ],
  byCountry: [
    { country: 'Germany', clicks: 412 },
    { country: 'United States', clicks: 298 },
    { country: 'Greece', clicks: 187 },
    { country: 'United Kingdom', clicks: 143 },
    { country: 'France', clicks: 89 },
  ],
  byBrowser: [
    { browser: 'Chrome', clicks: 721 },
    { browser: 'Safari', clicks: 289 },
    { browser: 'Firefox', clicks: 156 },
    { browser: 'Edge', clicks: 87 },
  ],
};

const MOCK_USAGE = {
  linksCreated: 42,
  linkLimit: 100,
  linksRemaining: 58,
  keysCreated: 3,
  keyLimit: 10,
  keysRemaining: 7,
  resetDate: '2026-07-01T00:00:00.000Z',
  retentionMs: 94608000000,
};

export const handlers = [
  // Auth
  http.get('/api/auth/me', () => HttpResponse.json(MOCK_USER, { status: 200 })),
  http.post('/api/auth/login', () => HttpResponse.json(MOCK_USER, { status: 200 })),
  http.post('/api/auth/register', () =>
    HttpResponse.json({ ...MOCK_USER, id: 'usr_new' }, { status: 201 }),
  ),
  http.post('/api/auth/logout', () => new HttpResponse(null, { status: 204 })),

  // URLs
  http.get('/api/urls', () => HttpResponse.json({ data: MOCK_LINKS })),
  http.post('/api/urls', async ({ request }) => {
    const body = (await request.json()) as { url: string };
    return HttpResponse.json(
      {
        shortUrl: 'xyz' + Math.random().toString(36).slice(2, 7),
        originalUrl: body.url,
        createdAt: new Date().toISOString(),
        expiresAt: null,
      },
      { status: 201 },
    );
  }),
  http.delete('/api/urls/:slug', () => new HttpResponse(null, { status: 204 })),

  // API Keys
  http.get('/api/api-keys', () => HttpResponse.json({ data: MOCK_API_KEYS })),
  http.post('/api/api-keys', async ({ request }) => {
    const body = (await request.json()) as { label: string };
    return HttpResponse.json(
      {
        id: 'key_new',
        label: body.label,
        key: 'mk_newkey_' + Math.random().toString(36).slice(2, 20),
        keyPrefix: 'mk_new0',
        createdAt: new Date().toISOString(),
      },
      { status: 201 },
    );
  }),
  http.delete('/api/api-keys/:id', () => new HttpResponse(null, { status: 204 })),

  // Stats
  http.get('/api/stats/:slug', () => HttpResponse.json(MOCK_STATS)),

  // Usage
  http.get('/api/usage', () => HttpResponse.json(MOCK_USAGE)),

  // Runtime config (guest shorten flag)
  http.get('/config.js', () =>
    new HttpResponse('window.__MIKROULI_CONFIG__ = { guestShortenEnabled: true };\n', {
      headers: { 'Content-Type': 'application/javascript' },
    }),
  ),
];
