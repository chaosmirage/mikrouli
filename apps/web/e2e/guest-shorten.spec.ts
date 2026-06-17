import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { test, expect, apiCall } from './fixtures';

// Guest shorten on the landing page.
//
// The happy-path test is an auth-flow carve-out (per playwright-best-practices):
// it asserts on the anonymous-visitor UI, so it clears cookies rather than
// using the shared authenticated session.
//
// The flag-off test toggles GUEST_SHORTEN_ENABLED via a docker compose env-file
// override + `docker compose up -d` on api and the prod web/nginx services.
// `docker compose up -d` re-creates containers with the new env value without
// rebuilding any image (the runtime-toggle invariant from design section 6).
// The override file is created in a gitignored directory and cleaned up in
// afterAll so no state leaks into the next spec.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const OVERRIDE_DIR = path.join(REPO_ROOT, '.e2e-overrides');
const OVERRIDE_FILE = path.join(OVERRIDE_DIR, 'guest-flag-off.yml');
const SERVICES = ['api', 'web', 'nginx'];

function composeCmd(args: string[]): void {
  execFileSync('docker', ['compose', ...args], {
    cwd: REPO_ROOT,
    stdio: 'pipe',
    env: { ...process.env, COMPOSE_PROFILES: 'prod' },
  });
}

test.describe('Guest shorten on the landing page', () => {
  test.describe.configure({ mode: 'serial' });

  test('happy path: anonymous visitor shortens, copies, sees the two-feature nudge', async ({
    page,
  }) => {
    // Carve-out: assert on the unauthenticated UX, so drop the shared session.
    await page.context().clearCookies();

    await page.goto('/');
    // The runtime flag must be on for the section to render. The default stack
    // ships with GUEST_SHORTEN_ENABLED=true, so the form appears.
    await expect(page.getByTestId('guest-shorten-section')).toBeVisible();
    await page.getByTestId('shorten-url').fill('https://example.com');
    await page.getByTestId('shorten-submit').click();

    // Short link renders with a copy affordance.
    await expect(page.getByTestId('new-link-alert')).toBeVisible();
    await expect(page.getByTestId('copy-link')).toBeVisible();

    // The nudge appears after the Guest shorten, naming EXACTLY the two
    // features: dashboard with click analytics, and API keys + MCP access.
    await expect(page.getByTestId('guest-nudge')).toBeVisible();
    await expect(page.getByTestId('guest-nudge-feature-dashboard')).toBeVisible();
    await expect(page.getByTestId('guest-nudge-feature-api-keys')).toBeVisible();
    await expect(page.getByTestId('guest-nudge-cta')).toHaveAttribute('href', '/register');
  });

  test('flag off: form hidden and unauthenticated POST returns 401 RFC 9457', async ({
    page,
    request,
  }) => {
    // Ensures any prior override is gone so the flag-off block starts from a
    // clean baseline (defensive against a previously failed run).
    test.skip(
      !process.env.E2E_GUEST_FLAG_TOGGLE,
      'flag-off toggle requires E2E_GUEST_FLAG_TOGGLE=1 (sets up docker restart)',
    );

    // 1. Flip the flag off via an env-file override and re-create the
    //    consuming services. No image rebuild — the runtime-toggle invariant.
    mkdirSync(OVERRIDE_DIR, { recursive: true });
    writeFileSync(
      OVERRIDE_FILE,
      [
        'services:',
        '  api:',
        '    environment:',
        '      GUEST_SHORTEN_ENABLED: "false"',
        '  web:',
        '    environment:',
        '      GUEST_SHORTEN_ENABLED: "false"',
      ].join('\n') + '\n',
    );
    composeCmd([
      'up',
      '-d',
      '--no-build',
      ...SERVICES,
      '--compose-file',
      'docker-compose.yml',
      '--compose-file',
      OVERRIDE_FILE,
    ]);

    try {
      // 2. Reload the landing page; the SPA fetches /config.js (now emitting
      //    guestShortenEnabled: false) and hides the form.
      await page.context().clearCookies();
      await page.goto('/', { waitUntil: 'networkidle' });
      await expect(page.getByTestId('guest-shorten-section')).toHaveCount(0);

      // 3. Unauthenticated POST /api/urls is rejected with 401 RFC 9457.
      const resp = await apiCall(request, 'POST', '/api/urls', {
        noAuth: true,
        data: { url: 'https://example.com' },
      });
      expect(resp.status()).toBe(401);
      expect(resp.headers()['content-type']).toContain('application/problem+json');
      const body = (await resp.json()) as { status?: number; title?: string };
      expect(body.status).toBe(401);
    } finally {
      // 4. Restore the default stack so the next spec starts clean.
      composeCmd(['up', '-d', '--no-build', ...SERVICES]);
      rmSync(OVERRIDE_DIR, { recursive: true, force: true });
    }
  });
});

// Clean up any stale override if the suite was interrupted before afterAll ran.
test.afterAll(() => {
  if (existsSync(OVERRIDE_DIR)) {
    try {
      composeCmd(['up', '-d', '--no-build', ...SERVICES]);
    } catch {
      // best-effort: if compose is unavailable, leave the override for the
      // operator to inspect; the next `docker compose up` re-creates state.
    }
    rmSync(OVERRIDE_DIR, { recursive: true, force: true });
  }
});
