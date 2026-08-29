import { test, expect } from '@playwright/test';

// Color mode and language are the setting pair; both live in one veiled panel
// reached from the shell band. The panel is independent of authentication (the
// landing renders the same shell for guests), so this spec drives the landing
// page only and avoids the shared-session dance in fixtures.ts.

// Every test here must actually reach the landing: the chromium project
// injects the shared session into each context, and GuestRoute bounces an
// authenticated visitor from '/' to '/dashboard' before the landing ever
// renders. The explicit empty storageState opts this file's scopes out of
// the shared session, so the tests observe the landing as a guest sees it.
test.use({ storageState: { cookies: [], origins: [] } });

const LANDING_PATH = '/';

// The German rendering of the footer's terms reach: the statement every
// rendered surface obeys after a language selection, observed through a stable
// address rather than a text selector.
const TERMS_REACH_GERMAN = 'Nutzungsbedingungen';

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

// The place beneath the panel is kept structurally: no route change occurs, and
// the standing content stays in the DOM under the veil.
async function expectPlaceKept(page: import('@playwright/test').Page) {
  expect(page.url().endsWith(LANDING_PATH)).toBe(true);
  await expect(page.getByTestId('page-content')).toBeVisible();
  await expect(page.getByTestId('landing-statement')).toBeVisible();
}

type ModeOption =
  | 'settings-mode-option-light'
  | 'settings-mode-option-dark'
  | 'settings-mode-option-follow-system';

async function openPanelAndSelectMode(page: import('@playwright/test').Page, option: ModeOption) {
  await page.getByTestId('settings-mode-reach').click();
  await expect(page.getByTestId('settings-panel')).toBeVisible();
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
// The setting pair: mode selection, immediate surface change, place kept
// ----------------------------------------------------------------------

test.describe('manual mode selection changes the surface synchronously', () => {
  test.use({ colorScheme: 'light' });

  test('selecting dark then light re-renders the surface without navigating', async ({
    page,
  }) => {
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto(LANDING_PATH);

    await openPanelAndSelectMode(page, 'settings-mode-option-dark');
    await expectSurfaceDark(page);
    await expectPlaceKept(page);

    // The panel is modal: lift it before the shell reach can open it again.
    await page.getByTestId('settings-close').click();
    await expect(page.getByTestId('settings-panel')).not.toBeVisible();

    await openPanelAndSelectMode(page, 'settings-mode-option-light');
    await expectSurfaceLight(page);
    await expectPlaceKept(page);
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

    await openPanelAndSelectMode(page, 'settings-mode-option-dark');
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

// ----------------------------------------------------------------------
// The setting pair: language selection obeys every rendered statement
// ----------------------------------------------------------------------

test.describe('language selection in the settings panel', () => {
  test('selecting German marks the choice and re-renders the shell statements in place', async ({
    page,
  }) => {
    await page.goto(LANDING_PATH);

    await page.getByTestId('settings-language-reach').click();
    await expect(page.getByTestId('settings-panel')).toBeVisible();
    await page.getByTestId('settings-language-option-de').click();

    // The current choice is marked in the pair; the superseded choice is not.
    await expect(page.getByTestId('settings-language-option-de')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByTestId('settings-language-option-en')).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    // Every rendered statement obeys the selection: the footer's terms reach
    // reads in German, and the place beneath the panel never changed.
    await expect(page.getByTestId('footer-terms')).toHaveText(TERMS_REACH_GERMAN);
    await expectPlaceKept(page);
  });

  test('the closing lifts the pair while the place beneath stands', async ({ page }) => {
    await page.goto(LANDING_PATH);

    await page.getByTestId('settings-mode-reach').click();
    await expect(page.getByTestId('settings-panel')).toBeVisible();

    await page.getByTestId('settings-close').click();
    await expect(page.getByTestId('settings-panel')).not.toBeVisible();
    await expectPlaceKept(page);
  });
});
