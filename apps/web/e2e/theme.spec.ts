import { test, expect } from '@playwright/test';

// Theme behavior is independent of authentication. The landing page renders
// for guests and surfaces the same app shell (with the theme switcher) used by
// authenticated users, so the spec drives the landing page only and avoids the
// shared-session dance in fixtures.ts.

const LANDING_PATH = '/';

// Read the body's computed background and split it into [r, g, b] channels.
// Returns null when the value is not an rgb(...) triple.
async function readSurfaceChannels(
  page: import('@playwright/test').Page,
): Promise<[number, number, number] | null> {
  const bg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
  const m = /rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/.exec(bg);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

// The body element receives the MUI background via CssBaseline. The matchMedia
// `change` event that drives follow-system updates is delivered asynchronously
// after page.emulateMedia returns, and React's subsequent re-render takes a
// tick; a one-shot read therefore races the OS-change pipeline. Polling the
// computed channels (via expect.poll, which honors the config's expect timeout)
// observes the surface the way a human reader would: once it has actually
// settled on the expected mode.
async function expectSurfaceDark(page: import('@playwright/test').Page) {
  await expect
    .poll(async () => {
      const c = await readSurfaceChannels(page);
      return c ? Math.max(...c) : 256;
    }, 'expected the body background to settle on a dark surface (all channels < 128)')
    .toBeLessThan(128);
}

async function expectSurfaceLight(page: import('@playwright/test').Page) {
  await expect
    .poll(async () => {
      const c = await readSurfaceChannels(page);
      return c ? Math.min(...c) : 0;
    }, 'expected the body background to settle on a light surface (all channels >= 200)')
    .toBeGreaterThanOrEqual(200);
}

async function openSwitcherAndSelect(
  page: import('@playwright/test').Page,
  option: 'theme-mode-option-light' | 'theme-mode-option-dark' | 'theme-mode-option-follow-system',
) {
  await page.getByTestId('theme-mode-switcher').click();
  await page.getByTestId(option).click();
}

// ----------------------------------------------------------------------
// First-paint under OS preferences (no stored choice, no flash)
//
// test.use() must be called at module or describe scope, never inside a
// test body. Each colorScheme variant lives in its own describe so the
// fixture override applies to exactly that one test.
// ----------------------------------------------------------------------

test.describe('first paint when OS prefers dark', () => {
  test.use({ colorScheme: 'dark' });

  test('renders a dark surface on first paint', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto(LANDING_PATH);
    await expectSurfaceDark(page);
  });
});

test.describe('first paint when OS prefers light', () => {
  test.use({ colorScheme: 'light' });

  test('renders a light surface on first paint', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto(LANDING_PATH);
    await expectSurfaceLight(page);
  });
});

// ----------------------------------------------------------------------
// Toggle behavior (immediate, no reload)
// ----------------------------------------------------------------------

test.describe('manual toggle changes the surface synchronously', () => {
  test.use({ colorScheme: 'light' });

  test('switching to dark then to light re-renders the surface', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto(LANDING_PATH);

    await openSwitcherAndSelect(page, 'theme-mode-option-dark');
    await expectSurfaceDark(page);

    await openSwitcherAndSelect(page, 'theme-mode-option-light');
    await expectSurfaceLight(page);
  });
});

// ----------------------------------------------------------------------
// Persistence across reload
// ----------------------------------------------------------------------

test.describe('explicit choice persists across reload', () => {
  test.use({ colorScheme: 'light' });

  test('after choosing dark, a reload keeps the dark surface and the stored key', async ({
    page,
  }) => {
    // Clear storage via an explicit evaluate after the first navigation,
    // NOT via addInitScript. addInitScript re-runs on every navigation
    // (including the in-test page.reload below) and would wipe the very
    // value (mikrouli.themeMode) this test verifies persists. Clearing
    // explicitly once after the initial load leaves the reload free to
    // observe the persisted choice.
    await page.goto(LANDING_PATH);
    await page.evaluate(() => window.localStorage.clear());
    // Re-load so the cleared storage is observed by the inline anti-flash
    // script and the React provider's lazy initializer.
    await page.goto(LANDING_PATH);

    await openSwitcherAndSelect(page, 'theme-mode-option-dark');
    await expectSurfaceDark(page);

    // Verify the canonical localStorage key got the raw enum string.
    const stored = await page.evaluate(() =>
      window.localStorage.getItem('mikrouli.themeMode'),
    );
    expect(stored).toBe('dark');

    await page.reload();
    await expectSurfaceDark(page);
  });
});

// ----------------------------------------------------------------------
// Follow-system: live OS change re-renders without a reload
// ----------------------------------------------------------------------

test.describe('follow-system tracks a live OS change', () => {
  test.use({ colorScheme: 'light' });

  test('emulating an OS change re-renders the app without a reload', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto(LANDING_PATH);

    // Confirm the default mode is follow-system (light surface under a light OS).
    await expectSurfaceLight(page);

    // Emulate the OS switching to dark — no reload.
    await page.emulateMedia({ colorScheme: 'dark' });
    await expectSurfaceDark(page);

    // Back to light, still no reload.
    await page.emulateMedia({ colorScheme: 'light' });
    await expectSurfaceLight(page);
  });
});
