# auth

## Purpose

Handles registration, login, session management, and token revocation for the
API. Authentication uses HttpOnly cookies so credentials are never readable by
client-side JavaScript. The refresh-token allowlist in Redis enables server-side
session invalidation.

## Key pieces

- `auth.controller.ts` -- REST endpoints: `POST /auth/register`, `/auth/login`,
  `/auth/refresh`, `/auth/logout`, `GET /auth/me`, `GET /auth/github`,
  `GET /auth/github/callback`. Login and register are throttled via the
  `AUTH_THROTTLE_NAME` bucket (10 req / 60 s). The two GitHub routes share
  the same throttle bucket. On a successful OAuth callback, session cookies
  are set and the browser is redirected to `/dashboard`.
- `auth.service.ts` -- credential validation, token pair issuance, refresh
  rotation, and revocation. `loginWithGithub` delegates account resolution to
  `usersService.findOrCreateFromProvider`, then reuses `issueTokens` as the
  join point -- the resulting session is identical to a credential login.
  Tokens are issued as HttpOnly cookies (`mikrouli_access` scoped to `/api`;
  `mikrouli_refresh` scoped to `/api/auth`). Refresh tokens carry a `jti` +
  `family` tracked in Redis under `auth:refresh:<family>`. `validateCredentials`
  runs a constant-time bcrypt compare against a decoy hash when the account
  has no password, preventing timing oracles that would reveal OAuth-only
  accounts.
- `github.strategy.ts` -- `GithubStrategy` (passport-github2 + Redis-backed
  CSRF state store) and `GithubOauthGuard`. The state store mints a 32-byte
  random token with a 10-minute TTL and atomically deletes it on the callback
  (`GETDEL`) so each state token validates exactly once. `validate()` calls the
  GitHub verified-emails API directly (the passport profile does not carry
  verified flags) and refuses the flow when no verified email is present.
  `GithubOauthGuard.handleRequest` normalises all guard-phase failures into
  `GithubOauthFailedError`.
- `github-oauth.errors.ts` -- typed OAuth error classes (`GithubNoVerifiedEmailError`,
  `GithubOauthFailedError`) and the route-scoped `GithubOauthRedirectFilter`
  which maps those two typed errors to `302 /login?error=<slug>`. The slug
  vocabulary is enumerated here; nothing user-controlled is reflected in the
  redirect target.
- `jwt.strategy.ts` -- Passport JWT strategy. Extracts the access token from
  the `mikrouli_access` cookie first, falling back to the `Authorization`
  bearer header. Pins `algorithms: ['HS256']` to prevent algorithm-confusion.
  Provider-agnostic: OAuth-issued access tokens have the same shape.
- `jwt-auth.guard.ts` -- standard NestJS guard; routes that need authentication
  apply `@UseGuards(JwtAuthGuard)`.
- `dto/` -- `RegisterDto`, `LoginDto`, `RefreshDto` with class-validator
  decorators; shapes are enforced by the global `ValidationPipe`.

## How to extend safely

- Any new auth endpoint must be registered in `apps/api/spec/main.tsp` before
  implementation; run `pnpm spec:all` to regenerate types.
- The `logout` endpoint returns 503 (not 200) when Redis revocation fails so
  the client is not falsely told the session is gone.
- Use `redisService.setOrThrow` / `getOrThrow` / `delOrThrow` for revocation
  operations -- these propagate Redis errors rather than silently degrading.
- Use `redisService.get` / `set` / `del` only for non-security-critical cache
  paths where a Redis outage should not block the user.
- Do not add new cookie names without adding a matching clear-cookie value in
  `buildClearCookieHeaders` so logout always clears every session cookie.
- Do not call `register` when a user already exists without considering
  enumeration: the current implementation returns the same error shape for
  both duplicate and new registrations.
- To add a new OAuth provider: create a new strategy file analogous to
  `github.strategy.ts`, register it in `auth.module.ts`, add authorize +
  callback routes to `auth.controller.ts`, and extend the `provider` column
  union in `provider-account.entity.ts`. Add typed error classes in a new
  errors file alongside the strategy. New error slugs must be added to all
  three i18n locale files in parity.
- The CSRF state store (`GithubStateStore`) uses `GETDEL` for atomic
  single-use verification. Do not replace it with separate GET + DEL calls,
  as that opens a TOCTOU race on concurrent callbacks.
- `GithubOauthRedirectFilter` is applied only to the callback route; the
  authorize route should not carry it (it never reaches the handler body).
