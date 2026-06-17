import { test, expect } from './fixtures';

test('footer is visible on landing page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('footer')).toBeVisible();
});

test('footer Terms link navigates to terms page', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('footer-terms').click();
  await page.waitForURL('**/terms');
  await expect(page.getByTestId('terms-page')).toBeVisible();
});

test('footer Privacy link navigates to privacy page', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('footer-privacy').click();
  await page.waitForURL('**/privacy');
  await expect(page.getByTestId('privacy-page')).toBeVisible();
});

test('footer contact link has correct mailto href', async ({ page }) => {
  await page.goto('/');
  const href = await page.getByTestId('footer-contact').getAttribute('href');
  expect(href).toContain('mailto:support@mikrou.li');
});

test('footer is visible on authenticated route', async ({ auth: _auth, page }) => {
  // The auth fixture navigates to /dashboard and waits for the URL to settle.
  await expect(page.getByTestId('footer')).toBeVisible();
});

test('terms page is reachable without authentication', async ({ page }) => {
  // Clear the shared session cookies so the legal pages' inverse-access-control
  // property is exercised: unauthenticated visitors must NOT be redirected to /login.
  await page.context().clearCookies();
  await page.goto('/terms');
  await expect(page).toHaveURL(/\/terms/);
  await expect(page.getByTestId('terms-page')).toBeVisible();
});

test('privacy page is reachable without authentication', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/privacy');
  await expect(page).toHaveURL(/\/privacy/);
  await expect(page.getByTestId('privacy-page')).toBeVisible();
});
