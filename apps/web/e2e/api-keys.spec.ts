import { test, expect } from '@playwright/test';
import { registerAndLogin, apiCall } from './fixtures';

const KEY_LABEL_CI = 'ci-test';
const KEY_LABEL_REVOKE = 'to-revoke';
const KEY_SECRET_MIN_LENGTH = 30;
const KEY_PREFIX = 'mk_';
const API_KEY_PATTERN = /mk_\S+/;

test('create key shows secret once with mk_ prefix', async ({ page }) => {
  await registerAndLogin(page);
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

test('api key can be used to create a link', async ({ page, request }) => {
  const { accessToken } = await registerAndLogin(page);
  const headers = { Authorization: `Bearer ${accessToken ?? ''}` };
  const keyData = { label: KEY_LABEL_CI };
  const createKeyResp = await apiCall(request, 'POST', '/api/api-keys', { headers, data: keyData });
  expect(createKeyResp.status()).toBe(201);
  const keyBody = await createKeyResp.json() as { key: string };
  const apiKeyHeader = { 'X-API-Key': keyBody.key };
  const linkData = { url: 'https://example.com/api-key-test' };
  const createLinkResp = await apiCall(request, 'POST', '/api/urls', { headers: apiKeyHeader, data: linkData });
  expect(createLinkResp.status()).toBe(201);
});

test('revoked key returns 401', async ({ page, request }) => {
  const { accessToken } = await registerAndLogin(page);
  const headers = { Authorization: `Bearer ${accessToken ?? ''}` };
  const keyData = { label: KEY_LABEL_REVOKE };
  const createResp = await apiCall(request, 'POST', '/api/api-keys', { headers, data: keyData });
  const keyBody = await createResp.json() as { id: string; key: string };
  await page.goto('/api-keys');
  await expect(page.getByTestId(`revoke-${keyBody.id}`)).toBeVisible();
  await page.getByTestId(`revoke-${keyBody.id}`).click();
  await page.getByTestId('revoke-confirm').click();
  const revokedHeader = { 'X-API-Key': keyBody.key };
  const linkData = { url: 'https://example.com' };
  const revokedResp = await apiCall(request, 'POST', '/api/urls', { headers: revokedHeader, data: linkData });
  expect(revokedResp.status()).toBe(401);
});
