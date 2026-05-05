import { test, expect, randomEmail, registerAndLogin, apiCall } from './fixtures';

const WRONG_PASSWORD = 'wrongpassword123';

test.beforeEach(async ({ page }) => {
  // Newer Chromium denies localStorage on about:blank — navigate to a real
  // page first so the document has an origin we can clear storage for.
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
});

test('register login and me returns user email', async ({ page: _page, auth, api }) => {
  expect(auth.accessToken).not.toBeNull();
  const resp = await api.call('GET', '/api/auth/me');
  expect(resp.ok()).toBe(true);
  const body = (await resp.json()) as { email: string };
  expect(body.email).toBe(auth.email);
});

test('wrong password shows login error alert', async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(randomEmail());
  await page.getByTestId('login-password').fill(WRONG_PASSWORD);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('login-error')).toBeVisible();
});

test('login stores access token in localStorage', async ({ page, auth: _auth }) => {
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
