import { test, expect } from './fixtures';

const KEY_LABEL_CI = 'ci-test';
const KEY_LABEL_REVOKE = 'to-revoke';
const KEY_SECRET_MIN_LENGTH = 30;
const KEY_PREFIX = 'mk_';
const API_KEY_PATTERN = /mk_\S+/;

test('create key shows secret once with mk_ prefix', async ({ page, auth: _auth }) => {
  await page.goto('/api-keys');
  await page.getByTestId('key-label').fill(KEY_LABEL_CI);
  await page.getByTestId('key-create').click();
  const alert = page.getByTestId('key-secret-once');
  await expect(alert).toBeVisible();
  const alertText = await alert.innerText();
  const match = API_KEY_PATTERN.exec(alertText);
  expect(match).not.toBeNull();
  expect(match![0].length).toBeGreaterThan(KEY_SECRET_MIN_LENGTH);
  expect(match![0].startsWith(KEY_PREFIX)).toBe(true);
});

test('api key can be used to create a link', async ({ page: _page, api }) => {
  const keyData = { label: KEY_LABEL_CI };
  const createKeyResp = await api.call('POST', '/api/api-keys', { data: keyData });
  expect(createKeyResp.status()).toBe(201);
  const keyBody = (await createKeyResp.json()) as { key: string };
  const linkData = { url: 'https://example.com/api-key-test' };
  // Use X-API-Key auth only (suppress bearer so the api-key path is exercised)
  const createLinkResp = await api.call('POST', '/api/urls', {
    noAuth: true,
    headers: { 'X-API-Key': keyBody.key },
    data: linkData,
  });
  expect(createLinkResp.status()).toBe(201);
});

test('revoked key returns 401', async ({ page, api }) => {
  const keyData = { label: KEY_LABEL_REVOKE };
  const createResp = await api.call('POST', '/api/api-keys', { data: keyData });
  const keyBody = (await createResp.json()) as { id: string; key: string };
  await page.goto('/api-keys');
  await expect(page.getByTestId(`revoke-${keyBody.id}`)).toBeVisible();
  await page.getByTestId(`revoke-${keyBody.id}`).click();
  // Wait for the DELETE /api/api-keys/{id} response so the next API call
  // doesn't race the revoke commit. Without this await, click() returns
  // synchronously after dispatching the event but before React invokes
  // attemptRevokeKey, and the X-API-Key request below can hit the api
  // before the revoke transaction commits → flaky 201 instead of 401.
  const revokeResponse = page.waitForResponse(
    (resp) =>
      resp.url().includes(`/api/api-keys/${keyBody.id}`) &&
      resp.request().method() === 'DELETE',
  );
  await page.getByTestId('revoke-confirm').click();
  await revokeResponse;
  // Dialog closes only after handleRevoke awaits the DELETE call —
  // double-checks the SPA finished its post-revoke state update.
  await expect(page.getByTestId('revoke-dialog')).toBeHidden();
  const linkData = { url: 'https://example.com' };
  // Use revoked X-API-Key only (noAuth suppresses bearer; the 401 is what we assert)
  const revokedResp = await api.call('POST', '/api/urls', {
    noAuth: true,
    headers: { 'X-API-Key': keyBody.key },
    data: linkData,
  });
  expect(revokedResp.status()).toBe(401);
});
