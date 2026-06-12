# pages

## Purpose

Top-level routed page components. Each file is a default-exported React
component that maps to a single application route. Pages own their local UI
state and delegate domain actions to hooks from `../auth/AuthContext` and
`../api/`.

## Key pieces

- `LoginPage.tsx` -- email/password login form plus a "Continue with GitHub"
  button. On mount, reads the `?error` search parameter to display OAuth
  callback errors (e.g. `github-oauth-failed`, `github-no-verified-email`);
  the raw slug is never rendered -- it is resolved through a fixed i18n key
  map (`OAUTH_ERROR_SLUG_TO_I18N_KEY`) before display. Unknown slugs fall back
  to `errors:generic`.
- `RegisterPage.tsx` -- email/password registration form plus a "Continue with
  GitHub" button. Performs client-side validation (email format, password
  length + mixed-case + digit) before submitting, showing inline field errors.
  On 409 from the API, displays `errors:emailAlreadyRegistered` (the API
  returns a decoy success shape internally, so this error is only surfaced when
  the email already exists in the same request's visible response).
- `DashboardPage.tsx`, `LandingPage.tsx`, `StatsPage.tsx`, `ApiKeysPage.tsx` --
  other routed pages; not part of the auth surface.

## How to extend safely

- All user-facing strings must be added to all three locale files
  (`en`, `de`, `el`) in `apps/web/src/i18n/locales/` in parity. The build
  does not fail on missing keys, but the UI will show the key string instead.
- OAuth error slugs shown in `LoginPage` are a fixed allowlist. To surface a
  new slug, add it to `OAUTH_ERROR_SLUG_TO_I18N_KEY` and add the corresponding
  i18n keys to all three locale files. Do not reflect the raw `?error` query
  parameter value into the DOM without routing it through this map.
- Both `LoginPage` and `RegisterPage` invoke `loginWithGithub` from
  `useAuth()` for the GitHub button -- the handler performs a full-page
  navigation, not a fetch. Do not wrap it in a `<form>` submit or replace it
  with `navigate()`.
- Client-side password validation in `RegisterPage` mirrors the server-side
  rules in `RegisterDto`. If the server rules change, update both sides.
