import { test, expect, registerAndLogin } from './fixtures';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8888';
const SUPPORT_MAILTO = 'mailto:support@mikrou.li';
const PROBLEM_JSON = 'application/problem+json';

interface UsageSummary {
  linksCreated: number;
  linkLimit: number;
  linksRemaining: number;
  keysCreated: number;
  keyLimit: number;
  keysRemaining: number;
  resetDate: string;
  retentionMs: number;
}

// The fill proportion a quota bar must carry: the used share of the allowance,
// rounded and clamped exactly the way the page renders it, so the assertion
// checks the proportion itself rather than a shape.
function fillPercent(created: number, limit: number): number {
  if (limit <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((created / limit) * 100)));
}

test('usage page renders both quota cards with determinate progress bars', async ({
  page,
  auth: _auth,
}) => {
  await page.goto('/usage');

  await expect(page.getByTestId('usage-page')).toBeVisible();
  await expect(page.getByTestId('links-quota-card')).toBeVisible();
  await expect(page.getByTestId('keys-quota-card')).toBeVisible();

  // Limits are shown as determinate progress bars (aria-valuenow = used percent).
  const linksBar = page.getByTestId('links-quota-card-progress');
  const keysBar = page.getByTestId('keys-quota-card-progress');
  await expect(linksBar).toBeVisible();
  await expect(keysBar).toBeVisible();
  await expect(linksBar).toHaveAttribute('aria-valuenow', /^\d+$/);
  await expect(keysBar).toHaveAttribute('aria-valuenow', /^\d+$/);

  await expect(page.getByTestId('reset-date')).toBeVisible();
  await expect(page.getByTestId('retention-info')).toBeVisible();

  // Request-more action is a mailto to support (no server endpoint).
  const requestMore = page.getByTestId('request-more-btn');
  await expect(requestMore).toBeVisible();
  await expect(requestMore).toHaveAttribute('href', new RegExp(SUPPORT_MAILTO));
});

test('quota bars carry the standing fill proportion of each allowance', async ({
  page,
  api,
  auth: _auth,
}) => {
  const summary = (await (await api.call('GET', '/api/usage')).json()) as UsageSummary;

  await page.goto('/usage');
  await expect(page.getByTestId('usage-page')).toBeVisible();

  await expect(page.getByTestId('links-quota-card-progress')).toHaveAttribute(
    'aria-valuenow',
    String(fillPercent(summary.linksCreated, summary.linkLimit)),
  );
  await expect(page.getByTestId('keys-quota-card-progress')).toHaveAttribute(
    'aria-valuenow',
    String(fillPercent(summary.keysCreated, summary.keyLimit)),
  );
});

test('GET /api/usage reflects a newly created link', async ({ page: _page, api }) => {
  const before = (await (await api.call('GET', '/api/usage')).json()) as UsageSummary;
  expect(before.linkLimit).toBeGreaterThan(0);

  const created = await api.call('POST', '/api/urls', {
    data: { url: 'https://example.com/usage-count-target' },
  });
  expect(created.status()).toBe(201);

  const after = (await (await api.call('GET', '/api/usage')).json()) as UsageSummary;
  expect(after.linksCreated).toBe(before.linksCreated + 1);
  expect(after.linksRemaining).toBe(before.linksRemaining - 1);
});

test('GET /api/usage requires authentication', async ({ api }) => {
  const resp = await api.call('GET', '/api/usage', { noAuth: true });
  expect(resp.status()).toBe(401);
});

test('creating API keys beyond the monthly limit returns 429 problem-details', async ({
  page,
  request: _request,
}) => {
  // Use a fresh identity so the monthly key count starts at zero and the limit
  // is reached deterministically. Clear the shared session first so register
  // is not bounced to the dashboard by the guest route.
  await page.context().clearCookies();
  await registerAndLogin(page);

  const usage = (await (await page.request.fetch(`${BASE_URL}/api/usage`)).json()) as UsageSummary;
  const remaining = usage.keyLimit - usage.keysCreated;
  expect(remaining).toBeGreaterThan(0);

  // Exhaust the remaining allowance; each create must succeed.
  for (let i = 0; i < remaining; i += 1) {
    const ok = await page.request.fetch(`${BASE_URL}/api/api-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: { label: `quota-fill-${i}` },
    });
    expect(ok.status()).toBe(201);
  }

  // The next create crosses the limit: 429 with RFC 9457 problem-details.
  const overLimit = await page.request.fetch(`${BASE_URL}/api/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: { label: 'quota-over' },
  });
  expect(overLimit.status()).toBe(429);
  expect(overLimit.headers()['content-type'] ?? '').toContain(PROBLEM_JSON);
  const problem = (await overLimit.json()) as { status?: number; title?: string };
  expect(problem.status).toBe(429);
});
