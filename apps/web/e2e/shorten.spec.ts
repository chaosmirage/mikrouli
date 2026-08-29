import { test, expect } from './fixtures';

const LONG_URL = 'https://example.com/long/path';
const DELETE_URL = 'https://example.com/to-delete';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('shorten form creates link and row appears in table', async ({ page, auth: _auth }) => {
  await page.getByTestId('shorten-url').fill(LONG_URL);
  await page.getByTestId('shorten-submit').click();
  await expect(page.getByTestId('new-link-alert')).toBeVisible();
  const shortUrl = (await page.getByTestId('result-link').innerText()).trim();
  const slug = shortUrl.split('/').at(-1) ?? '';
  await expect(page.getByTestId(`link-row-${slug}`)).toBeVisible();
});

test('short url redirects with 302 to original url', async ({ page: _page, api }) => {
  const data = { url: LONG_URL };
  const createResp = await api.call('POST', '/api/urls', { data });
  const body = (await createResp.json()) as { shortUrl: string };
  const slug = body.shortUrl.split('/').at(-1) ?? '';
  // Redirect check: unauthenticated, no redirects followed (noAuth so no bearer; maxRedirects: 0 to capture the 302)
  const redirect = await api.call('GET', `/${slug}`, { noAuth: true, maxRedirects: 0 });
  expect(redirect.status()).toBe(302);
  expect(redirect.headers()['location']).toBe(LONG_URL);
});

test('copy button writes short url to clipboard and confirms the landing beside the control', async ({
  page,
  auth: _auth,
}) => {
  await page.getByTestId('shorten-url').fill(LONG_URL);
  await page.getByTestId('shorten-submit').click();
  await expect(page.getByTestId('new-link-alert')).toBeVisible();
  const shortUrl = (await page.getByTestId('result-link').innerText()).trim();
  await page.getByTestId('copy-link').click();

  // The take is never silent: the landed confirmation stands beside the
  // control in the same glance.
  await expect(page.getByTestId('copy-link-landed')).toBeVisible();

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe(shortUrl);
});

test('delete link removes row and slug returns 404', async ({ page, api }) => {
  // The link is created through the standing page so its row surfaces via the
  // in-place list refresh. A mid-suite page.reload() re-probes /api/auth/me,
  // and the auth throttle (429 inside its window) order-dependently bounces a
  // valid session to /login, so the row never renders; creating in place
  // removes that reload dependency entirely.
  await page.getByTestId('shorten-url').fill(DELETE_URL);
  await page.getByTestId('shorten-submit').click();
  await expect(page.getByTestId('new-link-alert')).toBeVisible();
  const shortUrl = (await page.getByTestId('result-link').innerText()).trim();
  const slug = shortUrl.split('/').at(-1) ?? '';

  await expect(page.getByTestId(`link-row-${slug}`)).toBeVisible();
  await page.getByTestId(`delete-${slug}`).click();
  await page.getByTestId('delete-confirm').click();
  await expect(page.getByTestId(`link-row-${slug}`)).not.toBeVisible();
  // Deleted slug must return 404 (noAuth: no bearer for this unauthenticated check)
  const notFound = await api.call('GET', `/${slug}`, { noAuth: true });
  expect(notFound.status()).toBe(404);
});
