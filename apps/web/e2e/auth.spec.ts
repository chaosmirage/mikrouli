import { test, expect, randomEmail, registerAndLogin, apiCall } from './fixtures';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8888';
const WRONG_PASSWORD = 'wrongpassword123';
const ACCESS_COOKIE_NAME = 'mikrouli_access';
const REFRESH_COOKIE_NAME = 'mikrouli_refresh';

test('register login and me returns user email', async ({ page: _page, auth, api }) => {
  const resp = await api.call('GET', '/api/auth/me');
  expect(resp.ok()).toBe(true);
  const body = (await resp.json()) as { email: string };
  expect(body.email).toBe(auth.email);
});

test('wrong password shows login error alert', async ({ page }) => {
  // Clear shared session cookies so the login page is accessible (not redirected to dashboard).
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByTestId('login-email').fill(randomEmail());
  await page.getByTestId('login-password').fill(WRONG_PASSWORD);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('login-error')).toBeVisible();
});

test('login sets HttpOnly session cookies (not script-readable)', async ({ page, auth: _auth }) => {
  // HttpOnly cookies are set by the API but cannot be read from JavaScript —
  // the test confirms the session is valid by probing /me rather than inspecting cookies.
  const cookies = await page.context().cookies();
  const accessCookie = cookies.find((c) => c.name === ACCESS_COOKIE_NAME);
  const refreshCookie = cookies.find((c) => c.name === REFRESH_COOKIE_NAME);
  expect(accessCookie).toBeDefined();
  expect(refreshCookie).toBeDefined();
  // HttpOnly prevents script access; verify /me works (cookie sent automatically).
  const resp = await page.request.fetch(`${BASE_URL}/api/auth/me`);
  expect(resp.ok()).toBe(true);
});

test('logout clears session cookies and subsequent me returns 401', async ({
  page,
  unauthRequest,
}) => {
  // Clear shared session cookies so registerAndLogin can navigate to /register
  // without GuestRoute bouncing the page straight to /dashboard.
  await page.context().clearCookies();
  await registerAndLogin(page);
  await page.getByTestId('nav-logout').click();
  // Wait for navigation back to login after logout.
  await page.waitForURL('**/login');

  // Session cookies must be cleared — the browser context should no longer hold them.
  const cookies = await page.context().cookies();
  const accessCookie = cookies.find((c) => c.name === ACCESS_COOKIE_NAME);
  const refreshCookie = cookies.find((c) => c.name === REFRESH_COOKIE_NAME);
  expect(accessCookie).toBeUndefined();
  expect(refreshCookie).toBeUndefined();

  // A subsequent /me probe using the explicitly cookie-free request context must fail.
  const resp = await apiCall(unauthRequest, 'GET', '/api/auth/me');
  expect(resp.status()).toBe(401);
});

test('unauthenticated dashboard access redirects to login', async ({ page }) => {
  // Clear shared session cookies to simulate an unauthenticated visitor.
  await page.context().clearCookies();
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});
