# pages

## Purpose

Top-level page components for the React SPA. Each file exports one default
page component; the router in `App.tsx` maps URL paths to these components.
All copy is externalised via `react-i18next` -- no inline user-visible
strings appear in page files.

## Key pieces

- `LandingPage.tsx` -- guest-facing marketing page. Composed of five
  sections: `HeroSection` (headline + primary CTAs), `GuestShortenSection`
  (anonymous shorten form plus a post-shorten sign-up nudge; only rendered
  for unauthenticated visitors when the runtime `GUEST_SHORTEN_ENABLED` flag
  is on, read via the `useGuestShortenEnabled` hook that fetches
  `/config.js`), `FeaturesSection` (three feature cards), `AgentSection`
  (advertises REST and MCP programmatic access, links to `/connect`), and
  `BottomCtaSection` (secondary conversion CTA). All copy uses the `landing`
  i18n namespace. Every section carries a `data-testid` that
  `LandingPage.test.tsx` asserts on (e.g. `landing-hero`,
  `guest-shorten-section`, `landing-features`, `agent-section`).
  `GuestShortenSection` mounts `ShortenCard` (from `components/ShortenCard`)
  and reveals the nudge (`data-testid="guest-nudge"`) only after a
  successful shorten. The section is hidden (returns `null`) for
  authenticated visitors or while the flag is still loading, so the form
  never flashes before the flag resolves.
- `ConnectPage.tsx` -- public integration guide page at `/connect`. Carries
  three sections: `ApiKeySection` (`data-testid="connect-apikey-section"`)
  with step-by-step instructions for obtaining an API key, `RestSection`
  (`data-testid="connect-rest-section"`) with a copy-pasteable `curl`
  example for `POST /api/urls`, and `McpSection`
  (`data-testid="connect-mcp-section"`) with an MCP Streamable HTTP
  initialization example and the exact `claude mcp add --scope user
--transport http` command for wiring the server into Claude Code. Uses
  the `connect` i18n namespace.
- `DashboardPage.tsx` -- authenticated user dashboard. Lists the user's
  shortened links with creation date and click count, and lets the owner
  edit a link's destination inline. The edit affordance is a per-row
  `EditIcon` button (`components/EditLinkDialog`) that opens a single
  shared dialog instance seeded with the row's slug and current
  `originalUrl`; confirming calls `PATCH /api/urls/{slug}`. On a rejected
  destination (SSRF or URL-shape validation), the dialog stays open showing
  the problem-details message so the owner can correct and resubmit
  instead of losing the previous destination. On success the `links` query
  is invalidated so the table reflects the new destination.
- `StatsPage.tsx` -- per-link analytics. Reads the `slug` route parameter
  and renders click-count time series from `GET /api/stats/:slug`.
- `ApiKeysPage.tsx` -- API key management. Calls `POST /api/api-keys`
  (JWT/cookie-guarded), displays the plaintext key once via `NewKeyAlert`
  (`data-testid="key-secret-once"`), and lists / revokes existing keys.
- `UsagePage.tsx` -- authenticated usage dashboard at `/usage`. Fetches
  `GET /api/usage` via `apiFetch` and renders two `QuotaCard` panels (links
  and API keys) showing monthly created / limit / remaining counts with a
  `LinearProgress` fill. Also shows the monthly reset date
  (`data-testid="reset-date"`) and the default link retention period
  (`data-testid="retention-info"`). A "Request more" button constructs a
  `mailto:support@mikrou.li` href pre-filled from the `usage` i18n namespace.
  Uses the `usage` i18n namespace.
- `TermsPage.tsx` -- public Terms-of-Service page at `/terms`. Static
  content page (same template as `ConnectPage.tsx`) rendered with
  `useTranslation('legal')`; carries `data-testid="terms-page"` plus one
  `data-testid` per section, asserted by `TermsPage.test.tsx`. Routed
  directly (not inside `GuestRoute`) so it stays reachable when a user is
  logged in -- the footer links here from every route.
- `PrivacyPage.tsx` -- public Privacy-Policy page at `/privacy`. Mirrors
  `TermsPage.tsx`: `useTranslation('legal')`, `data-testid="privacy-page"`
  and per-section testids, asserted by `PrivacyPage.test.tsx`. Also routed
  directly outside `GuestRoute` and linked from the footer.
- `LoginPage.tsx`, `RegisterPage.tsx` -- authentication forms.

## How to extend safely

- Every section in a page component must carry a unique `data-testid` and
  a corresponding assertion in the companion `*.test.tsx` file.
- All user-visible copy must live in the matching locale file under
  `src/i18n/locales/`; add or remove every key in all three locales
  (`en`, `de`, `el`) simultaneously to maintain parity.
- A new public page accessible to unauthenticated users (including agents)
  must NOT be wrapped in `GuestRoute` if it should remain reachable when
  the user is logged in. `GuestRoute` redirects authenticated users away;
  `ConnectPage` and the landing page are routed directly to avoid this.
- `ApiKeysPage` shows the plaintext key exactly once after creation
  (`secretOnce` state). Do not persist the plaintext secret beyond the
  single-render display or expose it via any state-management layer.
