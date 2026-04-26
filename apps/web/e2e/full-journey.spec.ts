import { test, expect } from '@playwright/test';
import type { Browser, Page, APIRequestContext } from '@playwright/test';
import { registerAndLogin, apiCall } from './fixtures';

const JOURNEY_URL = 'https://example.com/journey-link';
const JOURNEY_API_URL = 'https://example.com/api-key-journey';
const JOURNEY_KEY_LABEL = 'journey-key';
const STATS_FLUSH_WAIT_MS = 11_000;
const JOURNEY_TIMEOUT_MS = 90_000;
const API_KEY_PATTERN = /mk_\S+/;

async function createLinkViaUi(page: Page, url: string): Promise<string> {
  await page.getByTestId('shorten-url').fill(url);
  await page.getByTestId('shorten-submit').click();
  await expect(page.getByTestId('new-link-alert')).toBeVisible();
  const alertText = await page.getByTestId('new-link-alert').innerText();
  return alertText.trim();
}

async function openSlugIncognito(browser: Browser, slug: string): Promise<void> {
  const ctx = await browser.newContext();
  const incognitoPage = await ctx.newPage();
  await incognitoPage.goto(`/${slug}`, { waitUntil: 'commit' });
  await ctx.close();
}

async function assertStatsFlush(
  page: Page,
  request: APIRequestContext,
  slug: string,
  token: string,
): Promise<void> {
  await page.waitForTimeout(STATS_FLUSH_WAIT_MS);
  await page.goto(`/stats/${slug}`);
  const headers = { Authorization: `Bearer ${token}` };
  const resp = await apiCall(request, 'GET', `/api/stats/${slug}`, { headers });
  const body = await resp.json() as { totalClicks: number };
  expect(body.totalClicks).toBeGreaterThanOrEqual(1);
}

async function createKeyAndCaptureSecret(page: Page): Promise<string> {
  await page.getByTestId('key-label').fill(JOURNEY_KEY_LABEL);
  await page.getByTestId('key-create').click();
  await expect(page.getByTestId('key-secret-once')).toBeVisible();
  const alertText = await page.getByTestId('key-secret-once').innerText();
  const match = API_KEY_PATTERN.exec(alertText);
  expect(match).not.toBeNull();
  return match![0];
}

async function revokeKeyByLabel(
  page: Page,
  request: APIRequestContext,
  label: string,
  token: string,
): Promise<void> {
  const headers = { Authorization: `Bearer ${token}` };
  const resp = await apiCall(request, 'GET', '/api/api-keys', { headers });
  const body = await resp.json() as { data: Array<{ id: string; label: string }> };
  const keyEntry = body.data.find((k) => k.label === label);
  await page.getByTestId(`revoke-${keyEntry?.id ?? ''}`).click();
  await page.getByTestId('revoke-confirm').click();
}

async function deleteLinkBySlug(page: Page, slug: string): Promise<void> {
  await page.goto('/dashboard');
  await expect(page.getByTestId(`delete-${slug}`)).toBeVisible();
  await page.getByTestId(`delete-${slug}`).click();
  await page.getByTestId('delete-confirm').click();
}

test('full user journey from register through delete', async ({ page, request, browser }) => {
  test.setTimeout(JOURNEY_TIMEOUT_MS);

  const { accessToken } = await registerAndLogin(page);
  const token = accessToken ?? '';

  const shortUrl = await createLinkViaUi(page, JOURNEY_URL);
  const slug = shortUrl.split('/').at(-1) ?? '';

  await openSlugIncognito(browser, slug);
  await assertStatsFlush(page, request, slug, token);

  await page.goto('/api-keys');
  const secret = await createKeyAndCaptureSecret(page);

  const apiKeyHeader = { 'X-API-Key': secret };
  const apiLinkData = { url: JOURNEY_API_URL };
  const apiLinkResp = await apiCall(request, 'POST', '/api/urls', { headers: apiKeyHeader, data: apiLinkData });
  expect(apiLinkResp.status()).toBe(201);

  await revokeKeyByLabel(page, request, JOURNEY_KEY_LABEL, token);

  const revokedResp = await apiCall(request, 'POST', '/api/urls', { headers: apiKeyHeader, data: { url: 'https://example.com' } });
  expect(revokedResp.status()).toBe(401);

  await deleteLinkBySlug(page, slug);

  const notFoundResp = await apiCall(request, 'GET', `/${slug}`);
  expect(notFoundResp.status()).toBe(404);
});
