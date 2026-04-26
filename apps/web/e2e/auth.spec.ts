import { test, expect } from '@playwright/test';
import { randomEmail, registerAndLogin, apiCall } from './fixtures';

const WRONG_PASSWORD = 'wrongpassword123';

test.beforeEach(async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
});

test('register login and me returns user email', async ({ page, request }) => {
  const { email, accessToken } = await registerAndLogin(page);
  expect(accessToken).not.toBeNull();
  const opts = { headers: { Authorization: `Bearer ${accessToken ?? ''}` } };
  const resp = await apiCall(request, 'GET', '/api/auth/me', opts);
  expect(resp.ok()).toBe(true);
  const body = (await resp.json()) as { email: string };
  expect(body.email).toBe(email);
});

test('wrong password shows login error alert', async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(randomEmail());
  await page.getByTestId('login-password').fill(WRONG_PASSWORD);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('login-error')).toBeVisible();
});

test('login stores access token in localStorage', async ({ page }) => {
  await registerAndLogin(page);
  const token = await page.evaluate(() => localStorage.getItem('accessToken'));
  expect(token).not.toBeNull();
});

test('logout clears tokens and unauthenticated me returns 401', async ({ page, request }) => {
  await registerAndLogin(page);
  await page.getByTestId('nav-logout').click();
  const token = await page.evaluate(() => localStorage.getItem('accessToken'));
  expect(token).toBeNull();
  const resp = await apiCall(request, 'GET', '/api/auth/me');
  expect(resp.status()).toBe(401);
});

test('unauthenticated dashboard access redirects to login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});
