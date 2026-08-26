# e2e

Playwright end-to-end suite for the web app: TypeScript specs that drive the
composed stack (SPA + API behind nginx) in a real Chromium browser and assert
user-visible behavior through data-testid selectors.

## Purpose

Exercise what unit tests cannot see: the composed stack on :8888 (nginx
routing, session cookies, Content-Security-Policy headers, real file
downloads), the register/login/shorten journeys, and the HTTP surface an
agent or third-party client consumes. Vitest covers component logic in
isolation; everything here runs against the deployed shape of the app.

## Key pieces

- `fixtures.ts` -- The fixture module every spec imports (`test`, `expect`);
  importing from `@playwright/test` directly bypasses the shared fixtures.
  Provides `auth` (shared session cookies loaded from storageState, page
  navigated to /dashboard before the test body runs), `api` (a
  `call(method, path, opts)` client: authenticated calls reuse the browser
  context cookie jar through `page.request`; `noAuth: true` switches to a
  cookie-free context for X-API-Key requests and unauthenticated probes),
  `unauthRequest` (the raw cookie-free context), and `registerAndLogin` /
  `randomEmail` helpers for minting fresh users.
- `global.setup.ts` -- The `setup` project: registers and logs in the shared
  test user once (idempotent) and persists the session to
  `.auth/shared-user.json`; the `chromium` project in `../playwright.config.ts`
  loads that file as its `storageState`, so most tests start authenticated
  without re-hitting the auth throttle.
- `shared-auth-constants.ts` -- Credentials for the shared setup user.
  Imports nothing from any Playwright test module, so setup code cannot be
  accidentally pulled into a spec.
- `qr-code.spec.ts` -- The file-download pattern: register a console listener
  before the interaction, start `page.waitForEvent('download')` before the
  click, assert `suggestedFilename()`, then read the artifact back with
  `readFile(await download.path())` and assert on its payload. This suite is
  the only environment where nginx's `img-src 'self' data:` CSP is enforced,
  so the final no-CSP-violation assertion is the regression net for `blob:`
  download URLs, which pass in Vitest, Storybook, and the dev server.
- One spec per feature surface: `auth`, `api-keys`, `stats`, `usage`,
  `guest-shorten`, `shorten`, `legal`, `theme`, `github-auth`,
  `llm-connect`, and the cross-feature `full-journey`.

## How to extend safely

- Run against the composed stack (nginx on :8888), not the Vite dev server:

  ```sh
  docker compose up
  pnpm --filter web e2e
  ```

  Set `E2E_BASE_URL` to target a different deployment.
- Target `data-testid` selectors (`getByTestId`); when a surface lacks one,
  add the testid on the component in `src/` instead of matching visible text
  or DOM structure.
- Tests start authenticated via the shared session. For the unauthenticated
  UX call `page.context().clearCookies()` first (see the guest carve-out in
  `qr-code.spec.ts`); for API-key or logged-out HTTP use
  `api.call(..., { noAuth: true, headers: { 'X-API-Key': key } })`.
- Follow the download pattern for any file-export test: console listener
  registered up front, `waitForEvent('download')` wrapping the click,
  filename assertion plus payload readback, and a final empty CSP-error
  assertion.
- Mint per-test resources with `randomEmail()` instead of resetting or
  deleting the shared setup user; the rest of the run depends on that
  session staying valid.
