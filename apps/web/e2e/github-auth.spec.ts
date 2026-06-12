import { test, expect } from './fixtures';

// The GitHub OAuth flow is a top-level browser navigation driven by
// window.location.assign('/api/auth/github'). A live GitHub OAuth App is an
// operational prerequisite that cannot be unit-tested, so these tests stub
// the /api/auth/github endpoint at the network layer and assert the observable
// behavior visible to the user: the button is present and initiates the correct
// request, and the error query-param is rendered from the fixed i18n dictionary.

const GITHUB_AUTHORIZE_PATH = '/api/auth/github';

test.describe('GitHub OAuth entry point', () => {
  test.beforeEach(async ({ page }) => {
    // Clear shared session so the login page is accessible (not bounced to dashboard).
    await page.context().clearCookies();
  });

  test('login page shows Continue with GitHub button', async ({ page }) => {
    await page.goto('/login');
    const btn = page.getByTestId('login-github');
    await expect(btn).toBeVisible();
  });

  test('Continue with GitHub button navigates to /api/auth/github', async ({ page }) => {
    // Intercept the navigation to /api/auth/github before it leaves the browser.
    // Respond with a plain 200 so Playwright does not follow the cross-site redirect
    // to github.com — we only need to assert the request was made.
    let githubAuthorizeCalled = false;
    await page.route(`**${GITHUB_AUTHORIZE_PATH}`, (route) => {
      githubAuthorizeCalled = true;
      // Fulfill with a minimal redirect-like response so window.location.assign
      // does not produce a net-error page that would break the test runner.
      return route.fulfill({ status: 302, headers: { location: '/login' } });
    });

    await page.goto('/login');
    const btn = page.getByTestId('login-github');
    await expect(btn).toBeVisible();

    await btn.click();

    // Wait for the intercepted request to arrive (top-level navigation is async).
    await page.waitForURL(/\/login/);
    expect(githubAuthorizeCalled).toBe(true);
  });

  test('register page shows Continue with GitHub button', async ({ page }) => {
    await page.goto('/register');
    const btn = page.getByTestId('register-github');
    await expect(btn).toBeVisible();
  });

  test('Continue with GitHub on register navigates to /api/auth/github', async ({ page }) => {
    let githubAuthorizeCalled = false;
    await page.route(`**${GITHUB_AUTHORIZE_PATH}`, (route) => {
      githubAuthorizeCalled = true;
      return route.fulfill({ status: 302, headers: { location: '/login' } });
    });

    await page.goto('/register');
    const btn = page.getByTestId('register-github');
    await expect(btn).toBeVisible();

    await btn.click();

    await page.waitForURL(/\/login/);
    expect(githubAuthorizeCalled).toBe(true);
  });
});

test.describe('GitHub OAuth error query-param rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('github-oauth-failed slug renders the mapped error message', async ({ page }) => {
    await page.goto('/login?error=github-oauth-failed');
    // The error message must be present; it must NOT be the raw slug.
    const alert = page.getByTestId('login-oauth-error');
    await expect(alert).toBeVisible();
    await expect(alert).not.toHaveText('github-oauth-failed');
    // The rendered text must be non-empty (i18n lookup succeeded, no key fallback).
    const text = await alert.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test('github-no-verified-email slug renders the mapped error message', async ({ page }) => {
    await page.goto('/login?error=github-no-verified-email');
    const alert = page.getByTestId('login-oauth-error');
    await expect(alert).toBeVisible();
    await expect(alert).not.toHaveText('github-no-verified-email');
    const text = await alert.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test('unknown error slug renders a generic fallback message and not the raw slug', async ({
    page,
  }) => {
    await page.goto('/login?error=some-unknown-error');
    const alert = page.getByTestId('login-oauth-error');
    await expect(alert).toBeVisible();
    await expect(alert).not.toHaveText('some-unknown-error');
  });

  test('no error query param renders no error alert', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('login-oauth-error')).not.toBeVisible();
  });
});
