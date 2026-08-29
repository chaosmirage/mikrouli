import { readFile } from 'node:fs/promises';
import { test as base, expect } from './fixtures';
import type { Page } from '@playwright/test';

const LONG_URL = 'https://example.com/long/path';

// Bounds for retrying the one authenticated dashboard load through a
// transient /api/auth/me throttle window: in full-suite order the suites
// running just before this file (notably llm-connect's rapid page loads)
// can exhaust the endpoint's per-IP window, and a load landing inside it
// reads as signed out and bounces to /login. The budget stays inside the
// first registered test's 30s timeout, which also covers fixture setup.
const AUTH_LOAD_ATTEMPTS = 4;
const AUTH_LOAD_OUTCOME_MS = 4_000;
const AUTH_LOAD_GAP_MS = 2_000;

// The registered flows share one authenticated page per worker. Every fresh
// page load boots the session bootstrap (/api/auth/me), and in full-suite
// order those repeated boot calls exhaust the API's throttle window, so the
// mid-suite tests read as signed out and time out on the shorten form. A
// worker-scoped fixture loads the dashboard exactly once and hands the same
// page to each test (the newContext call inherits the project's storageState
// and baseURL from playwright.config.ts, so the shared session still applies).
const test = base.extend<{}, { authPage: Page }>({
  authPage: [
    async ({ browser }, use) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await loadAuthenticatedDashboard(page);
      await use(page);
      await context.close();
    },
    { scope: 'worker' },
  ],
});

// Load the dashboard until the session bootstrap actually succeeds: the
// authenticated page shows the shorten form, while a throttled bootstrap
// bounces to the sign-in page. One retry per window slide, so the load waits
// out the saturation instead of failing the tests that depend on it.
async function loadAuthenticatedDashboard(page: Page) {
  for (let attempt = 1; attempt <= AUTH_LOAD_ATTEMPTS; attempt += 1) {
    await page.goto('/dashboard');
    // Each wait settles itself (the loser's rejection is folded into the
    // raced outcome), so no dangling promise rejects when the page reloads.
    const outcome: 'ready' | 'bounced' | 'pending' = await Promise.race([
      page.getByTestId('shorten-url').waitFor().then(
        () => 'ready' as const,
        () => 'bounced' as const,
      ),
      page.getByTestId('login-email').waitFor().then(
        () => 'bounced' as const,
        () => 'bounced' as const,
      ),
      page.waitForTimeout(AUTH_LOAD_OUTCOME_MS).then(() => 'pending' as const),
    ]);
    if (outcome === 'ready') return;
    await page.waitForTimeout(AUTH_LOAD_GAP_MS);
  }
  await expect(page.getByTestId('shorten-url')).toBeVisible();
}

// The shared page still carries the previous test's result moment, so a
// visible result proves nothing by itself. The form clears its input only on
// a successful shorten POST -- the same state update that renders the new
// result -- which makes the cleared input the success oracle each registered
// test gates on before asserting the result.
async function expectShortenSucceeded(page: Page) {
  await expect(page.getByTestId('shorten-url')).toHaveValue('');
}

test.describe.serial('QR code on shorten', () => {
  test('guest flow: QR code visible after shortening on landing page', async ({
    page,
  }) => {
    // Carve-out: assert on the unauthenticated UX, so drop the shared session.
    await page.context().clearCookies();

    await page.goto('/');
    await expect(page.getByTestId('guest-shorten-section')).toBeVisible();

    await page.getByTestId('shorten-url').fill(LONG_URL);
    await page.getByTestId('shorten-submit').click();

    // Short link renders with its result moment.
    await expect(page.getByTestId('result-confirmation')).toBeVisible();

    // QR code is visible in the result.
    await expect(page.getByTestId('qr-code')).toBeVisible();
  });

  test('registered flow: QR code visible after shortening on dashboard', async ({
    authPage: page,
  }) => {
    await page.getByTestId('shorten-url').fill(LONG_URL);
    await page.getByTestId('shorten-submit').click();
    await expectShortenSucceeded(page);

    // Short link renders with its result moment.
    await expect(page.getByTestId('result-confirmation')).toBeVisible();

    // QR code is visible in the result.
    await expect(page.getByTestId('qr-code')).toBeVisible();
  });

  test('registered flow: Download saves a PNG without a CSP violation', async ({
    authPage: page,
  }) => {
    // The download rasterizes the QR through data: URLs; a regression to blob:
    // would be refused by the app CSP (img-src 'self' data:) and logged here.
    const cspErrors: string[] = [];
    page.on('console', (msg) => {
      if (
        msg.type() === 'error' &&
        /content security policy/i.test(msg.text())
      ) {
        cspErrors.push(msg.text());
      }
    });

    await page.getByTestId('shorten-url').fill(LONG_URL);
    await page.getByTestId('shorten-submit').click();
    await expectShortenSucceeded(page);
    await expect(page.getByTestId('qr-code')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('qr-download').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^qr-.*\.png$/);
    expect(cspErrors).toEqual([]);
  });

  test('registered flow: Download saves an SVG of the same QR without a CSP violation', async ({
    authPage: page,
  }) => {
    // The download serializes the QR element into a data: URL; a regression
    // to blob: would be refused by the app CSP (img-src 'self' data:) and
    // logged here.
    const cspErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && /content security policy/i.test(msg.text())) {
        cspErrors.push(msg.text());
      }
    });

    await page.getByTestId('shorten-url').fill(LONG_URL);
    await page.getByTestId('shorten-submit').click();
    await expectShortenSucceeded(page);
    await expect(page.getByTestId('qr-code')).toBeVisible();

    // Oracle: the geometry of the QR standing on the page. Containment of
    // this path in the saved file proves it is the same QR without a decoder.
    const d = await page.getByTestId('qr-code').locator('svg path').first().getAttribute('d');
    expect(d).toBeTruthy();

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('qr-download-svg').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^qr-.*\.svg$/);

    // Readback: the artifact is a standalone, namespace-well-formed SVG of
    // the very element rendered above.
    const svg = await readFile(await download.path(), 'utf8');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain(d);

    expect(cspErrors).toEqual([]);
  });
});
