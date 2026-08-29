# pages

## Purpose

Top-level page components for the React SPA. Each file exports one default
page component; the router in `App.tsx` maps URL paths to these components.
All copy is externalised via `react-i18next` -- no inline user-visible
strings appear in page files.

## Key pieces

- `LandingPage.tsx` -- guest-facing landing page. Composed of three blocks:
  `FirstSightStatement` (`data-testid="landing-statement"`, headline and
  support line bounded by the reading measure), `GuestShortenSection`
  (`data-testid="guest-shorten-section"`, the anonymous shorten act plus the
  post-shorten register nudge; only rendered for unauthenticated visitors
  when the runtime `GUEST_SHORTEN_ENABLED` flag is on, read via the
  `useGuestShortenEnabled` hook that fetches `/config.js` -- loading and
  disabled both return `null`, so the form never flashes and stays hidden
  fail-safe on misconfiguration), and `ClaimsBand`
  (`data-testid="landing-claims"`) listing the free-capability claims as
  `landing-claim-<id>` rows (analytics, qr, agents, languages); the agents
  claim carries its reach to the connect surface
  (`data-testid="landing-claim-agents-reach"`). `GuestShortenSection` mounts
  `ShortenCard` (from `components/ShortenCard`, `landing` namespace) and
  reveals the nudge (`data-testid="guest-nudge"`) only after a successful
  shorten, with `guest-nudge-feature-kept-link` / `-dashboard` /
  `-api-keys` standings and the `guest-nudge-cta` register reach. All copy
  uses the `landing` i18n namespace; the block testids are asserted by
  `LandingPage.test.tsx`.
- `ConnectPage.tsx` -- public integration guide page at `/connect`, contained
  in the reading measure (`Container maxWidth="sm"`). Carries four zones:
  `ConnectionStatement` (what connecting does, plus the `/llms.txt` reach),
  `AuthorizationTerms` (`data-testid="connect-apikey-section"`) with the
  credential's obtaining steps, the `x-api-key` header standing, and the key
  format as labeled term rows, `RestTerms`
  (`data-testid="connect-rest-section"`) with the `POST /api/urls` endpoint
  and the takeable direct `curl` example
  (`data-testid="connect-example-direct"`), and `McpTerms`
  (`data-testid="connect-mcp-section"`) with the `/api/mcp` endpoint standing,
  an MCP Streamable HTTP initialization example, and the takeable
  `claude mcp add --scope user --transport http` harness command
  (`data-testid="connect-example-harness"`). The takeable examples take via
  `components/CopyControl` (one activation, landed confirmation). Uses the
  `connect` i18n namespace.
- `DashboardPage.tsx` -- authenticated user dashboard. The shared
  `ShortenCard` (`dashboard` namespace) stands above the links set: one
  `StandingsRow` per link (`data-testid="link-row-<slug>"`) whose identity
  is the full short link in the theme's technical register, whose standings
  are destination, createdAt (`created-<slug>`), and expiresAt
  (`expires-<slug>`), and whose acts are copy (`copy-<slug>`), stats
  (`stats-<slug>`, navigates to `/stats/<slug>`), edit (`edit-<slug>`), and
  delete (`delete-<slug>`, confirmed through `components/ConfirmDialog`
  with `delete-confirm`). A narrowing field
  (`data-testid="narrow-links"`) live-narrows the rows by slug or
  destination fragment, case-insensitive, with no submit. Editing is
  in-row destination correction: the row's `EditIcon` replaces the
  destination standing with `DestinationCorrection` inside the row (no
  dialog), its entering seeded with the row's current `originalUrl`
  (`edit-url-input-<slug>`) and confirm / cancel staying in the row
  (`edit-confirm-<slug>` / `edit-cancel-<slug>`); confirming calls
  `PATCH /api/urls/{slug}`. On a rejected destination (SSRF or URL-shape
  validation) the correction stays open stating the problem-details
  message in place (`edit-error-<slug>`) so the owner can correct and
  resubmit instead of losing the previous destination. On success the
  `links` query is invalidated so the set reflects the new destination.
  One row corrects at a time (reducer-held correction state).
- `StatsPage.tsx` -- per-link analytics. Reads the `slug` route parameter
  and renders click-count time series from `GET /api/stats/:slug`.
- `ApiKeysPage.tsx` -- API key management, in two zones: the issuing act
  (label entering + one confirm, no permission ceremony) and the standing
  review. Calls `POST /api/api-keys` (JWT/cookie-guarded); the secret's one
  showing (`data-testid="key-secret-once"`) states its receipt as the
  aftermath and carries the exact value as takeable text
  (`data-testid="key-secret-value"` via `components/CopyControl`). The review
  renders the issued credentials as labeled `StandingsRow` rows
  (`data-testid="api-keys-table"`) with locale-convention dates
  (`i18n/format.ts`); retiring is ONE act on the row
  (`data-testid="revoke-<id>"`) with no confirmation dialog -- the frozen
  operations carry no retire ceremony for credentials. A failed retire is
  silent: the refreshed list carries the truth.
- `UsagePage.tsx` -- authenticated usage dashboard at `/usage`. Fetches
  `GET /api/usage` via `apiFetch` and renders two `StandingCard` panels
  (links and API keys) showing monthly created / limit / remaining standings
  with a `LinearProgress` fill proportion; an exhausted allowance states the
  exhausted statement as resolved matter beside its fill
  (`data-testid="<card>-exhausted"`). The reset date
  (`data-testid="reset-date"`) and retention period
  (`data-testid="retention-info"`) read through `i18n/format.ts` and the
  locale's own plural forms. A "Request more" button constructs a
  `mailto:support@mikrou.li` href pre-filled from the `usage` i18n namespace.
  Uses the `usage` i18n namespace.
- `TermsPage.tsx` -- public Terms-of-Service page at `/terms`. Static
  content page sharing the legal reading template with `PrivacyPage.tsx`
  (reading-measure column `terms-reading`, the `legal-pair` reach to the
  sibling legal page, and the `legal-back` return) rendered with
  `useTranslation('legal')`; carries `data-testid="terms-page"` plus one
  `data-testid` per section, asserted by `TermsPage.test.tsx`. Routed
  directly (not inside `GuestRoute`) so it stays reachable when a user is
  logged in -- the footer links here from every route.
- `PrivacyPage.tsx` -- public Privacy-Policy page at `/privacy`. Mirrors
  `TermsPage.tsx`: `useTranslation('legal')`, `data-testid="privacy-page"`
  and per-section testids, asserted by `PrivacyPage.test.tsx`. Also routed
  directly outside `GuestRoute` and linked from the footer.
- `LoginPage.tsx`, `RegisterPage.tsx` -- authentication forms.
- `oauth-error.ts` -- `resolveOauthErrorKey(slug)`. The closed dictionary
  for federated-return error slugs: a known slug (`github-no-verified-email`,
  `github-oauth-failed`) resolves to its `auth`-namespace i18n key, any other
  value falls back to the generic error key, and the raw slug is never
  rendered. Both `LoginPage` and `RegisterPage` render the federated-return
  failure statement through this one path.

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
- `ApiKeysPage` shows the plaintext key exactly once after creation (the
  `issued` issue-outcome state). Do not persist the plaintext secret beyond
  the single-render display or expose it via any state-management layer.
