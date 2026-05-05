import { test, expect } from './fixtures';
import type { ApiClient } from './fixtures';
import type { Browser, Page } from '@playwright/test';

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
  api: ApiClient,
  slug: string,
): Promise<void> {
  await page.waitForTimeout(STATS_FLUSH_WAIT_MS);
  await page.goto(`/stats/${slug}`);
  const resp = await api.call('GET', `/api/stats/${slug}`);
  const body = (await resp.json()) as { totalClicks: number };
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
  api: ApiClient,
  label: string,
): Promise<void> {
  const resp = await api.call('GET', '/api/api-keys');
  const body = (await resp.json()) as { data: Array<{ id: string; label: string }> };
  const keyEntry = body.data.find((k) => k.label === label);
  const id = keyEntry?.id ?? '';
  await page.getByTestId(`revoke-${id}`).click();
  // Wait for DELETE to commit before returning so the caller can assume
  // the key is fully revoked (otherwise next API call may race).
  const revokeResponse = page.waitForResponse(
    (r) => r.url().includes(`/api/api-keys/${id}`) && r.request().method() === 'DELETE',
  );
  await page.getByTestId('revoke-confirm').click();
  await revokeResponse;
}

async function deleteLinkBySlug(page: Page, slug: string): Promise<void> {
  await page.goto('/dashboard');
  await expect(page.getByTestId(`delete-${slug}`)).toBeVisible();
  await page.getByTestId(`delete-${slug}`).click();
  // Same pattern: ensure DELETE /api/urls/{slug} committed before caller
  // tries to assert the slug is gone.
  const deleteResponse = page.waitForResponse(
    (r) => r.url().includes(`/api/urls/${slug}`) && r.request().method() === 'DELETE',
  );
  await page.getByTestId('delete-confirm').click();
  await deleteResponse;
}

test('full user journey from register through delete', async ({ page, api, browser }) => {
  test.setTimeout(JOURNEY_TIMEOUT_MS);

  const shortUrl = await createLinkViaUi(page, JOURNEY_URL);
  const slug = shortUrl.split('/').at(-1) ?? '';

  await openSlugIncognito(browser, slug);
  await assertStatsFlush(page, api, slug);

  await page.goto('/api-keys');
  const secret = await createKeyAndCaptureSecret(page);

  const apiLinkData = { url: JOURNEY_API_URL };
  // Use X-API-Key auth only (suppress bearer so the api-key path is exercised)
  const apiLinkResp = await api.call('POST', '/api/urls', {
    noAuth: true,
    headers: { 'X-API-Key': secret },
    data: apiLinkData,
  });
  expect(apiLinkResp.status()).toBe(201);

  await revokeKeyByLabel(page, api, JOURNEY_KEY_LABEL);

  // Revoked key must yield 401 (noAuth suppresses bearer so only the revoked key is sent)
  const revokedResp = await api.call('POST', '/api/urls', {
    noAuth: true,
    headers: { 'X-API-Key': secret },
    data: { url: 'https://example.com' },
  });
  expect(revokedResp.status()).toBe(401);

  await deleteLinkBySlug(page, slug);

  // Unauthenticated redirect lookup on a deleted slug must return 404
  const notFoundResp = await api.call('GET', `/${slug}`, { noAuth: true });
  expect(notFoundResp.status()).toBe(404);
});
