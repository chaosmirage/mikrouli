import { test, expect } from '@playwright/test';
import { registerAndLogin, apiCall } from './fixtures';

const LONG_URL = 'https://example.com/long/path';
const DELETE_URL = 'https://example.com/to-delete';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('shorten form creates link and row appears in table', async ({ page }) => {
  await registerAndLogin(page);
  await page.getByTestId('shorten-url').fill(LONG_URL);
  await page.getByTestId('shorten-submit').click();
  await expect(page.getByTestId('new-link-alert')).toBeVisible();
  const shortUrl = (await page.getByTestId('new-link-alert').innerText()).trim();
  await expect(page.getByTestId(`link-row-${shortUrl}`)).toBeVisible();
});

test('short url redirects with 302 to original url', async ({ page, request }) => {
  const { accessToken } = await registerAndLogin(page);
  const headers = { Authorization: `Bearer ${accessToken ?? ''}` };
  const data = { url: LONG_URL };
  const createResp = await apiCall(request, 'POST', '/api/urls', { headers, data });
  const body = await createResp.json() as { shortUrl: string };
  const slug = body.shortUrl.split('/').at(-1) ?? '';
  const redirect = await request.fetch(`/${slug}`, { maxRedirects: 0 });
  expect(redirect.status()).toBe(302);
  expect(redirect.headers()['location']).toBe(LONG_URL);
});

test('copy button writes short url to clipboard', async ({ page }) => {
  await registerAndLogin(page);
  await page.getByTestId('shorten-url').fill(LONG_URL);
  await page.getByTestId('shorten-submit').click();
  await expect(page.getByTestId('new-link-alert')).toBeVisible();
  const shortUrl = (await page.getByTestId('new-link-alert').innerText()).trim();
  await page.getByTestId('copy-link').click();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe(shortUrl);
});

test('delete link removes row and slug returns 404', async ({ page, request }) => {
  const { accessToken } = await registerAndLogin(page);
  const headers = { Authorization: `Bearer ${accessToken ?? ''}` };
  const data = { url: DELETE_URL };
  const createResp = await apiCall(request, 'POST', '/api/urls', { headers, data });
  const body = await createResp.json() as { shortUrl: string };
  const shortUrl = body.shortUrl;
  const slug = shortUrl.split('/').at(-1) ?? '';
  await page.reload();
  await expect(page.getByTestId(`link-row-${shortUrl}`)).toBeVisible();
  await page.getByTestId(`delete-${slug}`).click();
  await page.getByTestId('delete-confirm').click();
  await expect(page.getByTestId(`link-row-${shortUrl}`)).not.toBeVisible();
  const notFound = await apiCall(request, 'GET', `/${slug}`);
  expect(notFound.status()).toBe(404);
});
