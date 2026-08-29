import { test, expect } from './fixtures';

// The dashboard set: live narrowing of the standing rows, and the row's copy
// taking with its landed confirmation. Links are minted through the api
// fixture so the narrowing fragments are unique to this spec even though the
// shared session accumulates links across the whole run.

const ALPHA_URL = 'https://example.com/narrow-alpha';
const BETA_URL = 'https://example.com/narrow-beta';
const MATCHES_NOTHING = 'fragment-matching-nothing';

interface CreateLinkResponse {
  shortUrl: string;
}

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('a fragment narrows the set live, without a submit', async ({ page, api }) => {
  const alphaResp = await api.call('POST', '/api/urls', { data: { url: ALPHA_URL } });
  const betaResp = await api.call('POST', '/api/urls', { data: { url: BETA_URL } });
  const alphaBody = (await alphaResp.json()) as CreateLinkResponse;
  const betaBody = (await betaResp.json()) as CreateLinkResponse;
  const alphaSlug = alphaBody.shortUrl.split('/').at(-1) ?? '';
  const betaSlug = betaBody.shortUrl.split('/').at(-1) ?? '';

  await page.goto('/dashboard');
  await expect(page.getByTestId(`link-row-${alphaSlug}`)).toBeVisible();
  await expect(page.getByTestId(`link-row-${betaSlug}`)).toBeVisible();

  // A destination fragment, entered in caps, narrows case-insensitively as it
  // is typed. Each fragment narrows further; there is no submit.
  await page.getByTestId('narrow-links').fill('NARROW-ALPHA');
  await expect(page.getByTestId(`link-row-${alphaSlug}`)).toBeVisible();
  await expect(page.getByTestId(`link-row-${betaSlug}`)).not.toBeVisible();

  // A slug fragment narrows to the other row.
  await page.getByTestId('narrow-links').fill(betaSlug);
  await expect(page.getByTestId(`link-row-${betaSlug}`)).toBeVisible();
  await expect(page.getByTestId(`link-row-${alphaSlug}`)).not.toBeVisible();

  // A fragment that matches nothing states the honest empty, naming it.
  await page.getByTestId('narrow-links').fill(MATCHES_NOTHING);
  await expect(page.getByTestId('narrowed-empty')).toBeVisible();
  await expect(page.getByTestId('narrowed-empty')).toContainText(MATCHES_NOTHING);

  // Clearing the fragment restores the whole set.
  await page.getByTestId('narrow-links').fill('');
  await expect(page.getByTestId(`link-row-${alphaSlug}`)).toBeVisible();
  await expect(page.getByTestId(`link-row-${betaSlug}`)).toBeVisible();
  await expect(page.getByTestId('narrowed-empty')).not.toBeVisible();
});

test('a row copy lands with its confirmation standing beside the control', async ({
  page,
  api,
}) => {
  const createResp = await api.call('POST', '/api/urls', { data: { url: ALPHA_URL } });
  const body = (await createResp.json()) as CreateLinkResponse;
  const slug = body.shortUrl.split('/').at(-1) ?? '';

  await page.goto('/dashboard');
  await expect(page.getByTestId(`link-row-${slug}`)).toBeVisible();

  await page.getByTestId(`copy-${slug}`).click();

  // The take is never silent: the landed confirmation stands beside the row's
  // control, in the same glance.
  await expect(page.getByTestId(`copy-${slug}-landed`)).toBeVisible();

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain(slug);
});
