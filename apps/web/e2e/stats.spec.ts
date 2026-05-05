import { test, expect, apiCall, registerAndLogin } from './fixtures';

const TARGET_URL = 'https://example.com/stats-target';
const REDIRECT_HITS = 3;
const STATS_POLL_TIMEOUT_MS = 15_000;
const STATS_POLL_INTERVAL_MS = 500;

interface CreateLinkResponse {
  shortUrl: string;
}

interface StatsResponse {
  slug: string;
  totalClicks: number;
}

function slugFromShortUrl(shortUrl: string): string {
  return shortUrl.split('/').at(-1) ?? '';
}

test('stats endpoint reports clicks recorded via redirect', async ({ page: _page, api }) => {
  const createResp = await api.call('POST', '/api/urls', {
    data: { url: TARGET_URL },
  });
  expect(createResp.status()).toBe(201);
  const slug = slugFromShortUrl(((await createResp.json()) as CreateLinkResponse).shortUrl);

  for (let i = 0; i < REDIRECT_HITS; i += 1) {
    // Redirect fetch: unauthenticated, no redirects followed (noAuth; maxRedirects: 0 to capture the 302)
    const redirect = await api.call('GET', `/${slug}`, { noAuth: true, maxRedirects: 0 });
    expect(redirect.status()).toBe(302);
  }

  // ClickHouse async writer is fire-and-forget; poll until totals settle.
  await expect
    .poll(
      async () => {
        const resp = await api.call('GET', `/api/stats/${slug}`);
        if (resp.status() !== 200) return -1;
        const body = (await resp.json()) as StatsResponse;
        return body.totalClicks;
      },
      { timeout: STATS_POLL_TIMEOUT_MS, intervals: [STATS_POLL_INTERVAL_MS] },
    )
    .toBeGreaterThanOrEqual(REDIRECT_HITS);
});

test('stats page renders totals reflecting the redirect count', async ({ page, api }) => {
  const createResp = await api.call('POST', '/api/urls', {
    data: { url: TARGET_URL },
  });
  const slug = slugFromShortUrl(((await createResp.json()) as CreateLinkResponse).shortUrl);

  for (let i = 0; i < REDIRECT_HITS; i += 1) {
    // Redirect fetch: unauthenticated (noAuth so no bearer is sent)
    await api.call('GET', `/${slug}`, { noAuth: true });
  }

  // Wait for async stats to settle before navigating, so the page's
  // single fetch on mount sees a non-zero total.
  await expect
    .poll(
      async () => {
        const resp = await api.call('GET', `/api/stats/${slug}`);
        if (resp.status() !== 200) return -1;
        const body = (await resp.json()) as StatsResponse;
        return body.totalClicks;
      },
      { timeout: STATS_POLL_TIMEOUT_MS, intervals: [STATS_POLL_INTERVAL_MS] },
    )
    .toBeGreaterThanOrEqual(REDIRECT_HITS);

  await page.goto(`/stats/${slug}`);
  await expect(page.getByTestId('stats-view')).toBeVisible();
  await expect(page.getByTestId('stats-slug')).toHaveText(slug);
  const totalText = await page.getByTestId('stats-total').innerText();
  const totalNumber = Number(totalText.replace(/\D+/g, ''));
  expect(totalNumber).toBeGreaterThanOrEqual(REDIRECT_HITS);
});

test('stats endpoint returns 403 when called by another user', async ({ page, request }) => {
  const owner = await registerAndLogin(page);
  const ownerAuth = { Authorization: `Bearer ${owner.accessToken ?? ''}` };
  const createResp = await apiCall(request, 'POST', '/api/urls', {
    headers: ownerAuth,
    data: { url: TARGET_URL },
  });
  const slug = slugFromShortUrl(((await createResp.json()) as CreateLinkResponse).shortUrl);

  // Second user shouldn't see other users' stats.
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  const intruder = await registerAndLogin(page);
  const intruderAuth = { Authorization: `Bearer ${intruder.accessToken ?? ''}` };
  const resp = await apiCall(request, 'GET', `/api/stats/${slug}`, { headers: intruderAuth });
  expect(resp.status()).toBe(403);
});
