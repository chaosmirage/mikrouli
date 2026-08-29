import { test, expect, registerAndLogin } from './fixtures';

// Destination correction happens in the row that carries the link: the
// correction opens on the destination as it stands, pre-filled, and is
// confirmed in place. The row-scoped addresses (`edit-<slug>` to open,
// `edit-<slug>-input` / `edit-<slug>-confirm` / `edit-<slug>-error`) are the
// correction's harness contract; the superseded dialog addresses are retired
// with the dialog.

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8888';
const ORIGINAL_URL = 'https://example.com/edit-link-original';
const NEW_URL = 'https://example.com/edit-link-updated';
const PRIVATE_URL = 'http://127.0.0.1/internal';

interface CreateLinkResponse {
  shortUrl: string;
}

function slugFromShortUrl(shortUrl: string): string {
  return shortUrl.split('/').at(-1) ?? '';
}

test('correcting a destination in its row updates the redirect target immediately, keeping the short URL and analytics', async ({
  page,
  api,
}) => {
  const createResp = await api.call('POST', '/api/urls', { data: { url: ORIGINAL_URL } });
  expect(createResp.status()).toBe(201);
  const slug = slugFromShortUrl(((await createResp.json()) as CreateLinkResponse).shortUrl);

  // Warm the redirect cache with the original destination so the later
  // assertion proves the cache was overwritten, not merely expired.
  const warmupRedirect = await api.call('GET', `/${slug}`, { noAuth: true, maxRedirects: 0 });
  expect(warmupRedirect.status()).toBe(302);
  expect(warmupRedirect.headers()['location']).toBe(ORIGINAL_URL);

  await page.goto('/dashboard');
  await expect(page.getByTestId(`edit-${slug}`)).toBeVisible();
  await page.getByTestId(`edit-${slug}`).click();

  // The correction opens inside the row, pre-filled with the standing value.
  await expect(page.getByTestId(`edit-url-input-${slug}`)).toBeVisible();
  await expect(page.getByTestId(`edit-url-input-${slug}`)).toHaveValue(ORIGINAL_URL);

  await page.getByTestId(`edit-url-input-${slug}`).fill(NEW_URL);
  const editResponse = page.waitForResponse(
    (r) => r.url().includes(`/api/urls/${slug}`) && r.request().method() === 'PATCH',
  );
  await page.getByTestId(`edit-confirm-${slug}`).click();
  await editResponse;

  await expect(page.getByTestId(`link-row-${slug}`)).toContainText(NEW_URL);
  await expect(page.getByTestId(`link-row-${slug}`)).toContainText(slug);
  // The correction closed behind its confirmation: the row stands as before.
  await expect(page.getByTestId(`edit-url-input-${slug}`)).not.toBeVisible();

  const redirectAfterEdit = await api.call('GET', `/${slug}`, {
    noAuth: true,
    maxRedirects: 0,
  });
  expect(redirectAfterEdit.status()).toBe(302);
  expect(redirectAfterEdit.headers()['location']).toBe(NEW_URL);

  await page.goto(`/stats/${slug}`);
  await expect(page.getByTestId('stats-view')).toBeVisible();
});

test('a refused destination is stated in the row and the previous target stands', async ({
  page,
  api,
}) => {
  const createResp = await api.call('POST', '/api/urls', { data: { url: ORIGINAL_URL } });
  const slug = slugFromShortUrl(((await createResp.json()) as CreateLinkResponse).shortUrl);

  await page.goto('/dashboard');
  await page.getByTestId(`edit-${slug}`).click();
  await page.getByTestId(`edit-url-input-${slug}`).fill(PRIVATE_URL);

  const editResponse = page.waitForResponse(
    (r) => r.url().includes(`/api/urls/${slug}`) && r.request().method() === 'PATCH',
  );
  await page.getByTestId(`edit-confirm-${slug}`).click();
  await editResponse;

  // The refusal stands as a resolved statement beside the entering, which
  // keeps the draft so the owner can correct and confirm again.
  await expect(page.getByTestId(`edit-error-${slug}`)).toBeVisible();

  const redirect = await api.call('GET', `/${slug}`, { noAuth: true, maxRedirects: 0 });
  expect(redirect.status()).toBe(302);
  expect(redirect.headers()['location']).toBe(ORIGINAL_URL);
});

test('editing a link rejects a private-address destination and keeps the previous target', async ({
  api,
}) => {
  const createResp = await api.call('POST', '/api/urls', { data: { url: ORIGINAL_URL } });
  const slug = slugFromShortUrl(((await createResp.json()) as CreateLinkResponse).shortUrl);

  const patchResp = await api.call('PATCH', `/api/urls/${slug}`, { data: { url: PRIVATE_URL } });
  expect(patchResp.status()).toBe(422);

  const redirect = await api.call('GET', `/${slug}`, { noAuth: true, maxRedirects: 0 });
  expect(redirect.status()).toBe(302);
  expect(redirect.headers()['location']).toBe(ORIGINAL_URL);
});

test('editing a link owned by another user is refused with 403', async ({ page, api }) => {
  const createResp = await api.call('POST', '/api/urls', { data: { url: ORIGINAL_URL } });
  const slug = slugFromShortUrl(((await createResp.json()) as CreateLinkResponse).shortUrl);

  // Cross-user scenario: switch identity by clearing cookies and registering a
  // second account, mirroring the stats 403 spec's carve-out.
  await page.context().clearCookies();
  await registerAndLogin(page);

  const resp = await page.request.fetch(`${BASE_URL}/api/urls/${slug}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    data: { url: NEW_URL },
  });
  expect(resp.status()).toBe(403);
});
