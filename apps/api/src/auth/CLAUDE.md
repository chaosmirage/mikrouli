# auth

## Purpose

Handles registration, login, session management, and token revocation for the
API. Authentication uses HttpOnly cookies so credentials are never readable by
client-side JavaScript. The refresh-token allowlist in Redis enables server-side
session invalidation.

## Key pieces

- `auth.controller.ts` -- REST endpoints: `POST /auth/register`, `/auth/login`,
  `/auth/refresh`, `/auth/logout`, `GET /auth/me`. Login and register are
  throttled via the `AUTH_THROTTLE_NAME` bucket (10 req / 60 s).
- `auth.service.ts` -- credential validation, token pair issuance, refresh
  rotation, and revocation. Tokens are issued as HttpOnly cookies
  (`mikrouli_access` scoped to `/api`; `mikrouli_refresh` scoped to
  `/api/auth`). Refresh tokens carry a `jti` + `family` and are tracked in
  Redis under `auth:refresh:<family>`.
- `jwt.strategy.ts` -- Passport JWT strategy. Extracts the access token from
  the `mikrouli_access` cookie first, falling back to the `Authorization`
  bearer header. Pins `algorithms: ['HS256']` to prevent algorithm-confusion.
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
