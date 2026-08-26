import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures';

const LONG_URL = 'https://example.com/long/path';

test.describe('QR code on shorten', () => {
  test('guest flow: QR code visible after shortening on landing page', async ({
    page,
  }) => {
    // Carve-out: assert on the unauthenticated UX, so drop the shared session.
    await page.context().clearCookies();

    await page.goto('/');
    await expect(page.getByTestId('guest-shorten-section')).toBeVisible();

    await page.getByTestId('shorten-url').fill(LONG_URL);
    await page.getByTestId('shorten-submit').click();

    // Short link renders with success alert.
    await expect(page.getByTestId('new-link-alert')).toBeVisible();

    // QR code is visible in the result.
    await expect(page.getByTestId('qr-code')).toBeVisible();
  });

  test('registered flow: QR code visible after shortening on dashboard', async ({
    page,
    auth: _auth,
  }) => {
    await page.getByTestId('shorten-url').fill(LONG_URL);
    await page.getByTestId('shorten-submit').click();

    // Short link renders with success alert.
    await expect(page.getByTestId('new-link-alert')).toBeVisible();

    // QR code is visible in the result.
    await expect(page.getByTestId('qr-code')).toBeVisible();
  });

  test('registered flow: Download saves a PNG without a CSP violation', async ({
    page,
    auth: _auth,
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
    await expect(page.getByTestId('qr-code')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('qr-download').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^qr-.*\.png$/);
    expect(cspErrors).toEqual([]);
  });

  test('registered flow: Download saves an SVG of the same QR without a CSP violation', async ({
    page,
    auth: _auth,
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
