import { test, expect } from './fixtures';

// The landing's claims band: the free-capability claims, each naming its
// compared analog, standing in the glance below the first-sight statement and
// the guest act. Auth-flow carve-out (per playwright-best-practices): the
// arrival surface is the anonymous visitor's, so the shared session is dropped
// rather than carried into the page under test.

const CLAIM_IDS = ['analytics', 'qr', 'agents', 'languages'] as const;

test('a first-time visitor reads the first-sight statement and the full claims band', async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto('/');

  await expect(page.getByTestId('landing-statement')).toBeVisible();
  await expect(page.getByTestId('landing-claims')).toBeVisible();

  // Every free-capability claim stands as its own recognizable entry.
  for (const id of CLAIM_IDS) {
    await expect(page.getByTestId(`landing-claim-${id}`)).toBeVisible();
  }
});

test('the agent claim carries its reach to the public connect surface', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/');

  await expect(page.getByTestId('landing-claim-agents')).toBeVisible();
  await expect(page.getByTestId('landing-claim-agents-reach')).toHaveAttribute('href', '/connect');
});
