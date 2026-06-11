# 0011 - Cookie-Based JWT Auth and Refresh-Token Revocation

**Status:** Accepted

## Context

ADR 0007 described JWT bearer tokens returned in the response body and read
from the `Authorization: Bearer` header by the Passport JWT strategy. This
arrangement has two weaknesses for browser clients:

- **XSS exposure.** A token stored in `localStorage` or `sessionStorage` is
  accessible to any script running on the page. An HttpOnly cookie is
  inaccessible to JavaScript.
- **No revocation.** Refresh tokens were opaque to the server: once issued, a
  token was valid until expiry regardless of a logout or detected replay. There
  was no mechanism to invalidate a token family after suspicious reuse.

Evidence of the previous state: `apps/api/src/auth/jwt.strategy.ts` (before
this change) used `ExtractJwt.fromAuthHeaderAsBearerToken()` as the sole
extractor; `auth.service.ts` returned `{ accessToken, refreshToken }` as a
plain JSON body.

## Decision

Deliver JWT tokens via **HttpOnly, `SameSite=Strict` cookies** and implement
**refresh-token family revocation** backed by Redis.

**Cookie delivery.**
`auth.service.ts` (`issueTokens`) builds two `Set-Cookie` headers:
`mikrouli_access` (path `/api`, short-lived) and `mikrouli_refresh` (path
`/api/auth/refresh`, 7-day). Both are `HttpOnly`, `Secure` (in production),
and `SameSite=Strict`. The JWT strategy (`jwt.strategy.ts`) uses an extractor
chain: cookie first, then `Authorization: Bearer` as a fallback so CLI/test
clients continue to work.

**Refresh-token family revocation.**
Every call to `issueTokens` generates a `jti` (token ID) and a `family` UUID.
The `jti` is stored in Redis under the key `refresh-family:<family>` with a
TTL matching the refresh token's lifetime. On `rotateRefresh`:
1. The stored `jti` is fetched from Redis via `getOrThrow` (fail-closed on
   Redis unavailability — the service returns 503 rather than silently passing).
2. If the stored `jti` matches the presented token's `jti`, the rotation
   proceeds and a new `jti` overwrites the Redis key.
3. If the stored `jti` does not match the presented token's `jti`, the entire
   family is deleted from Redis (preventing further use by the attacker) and
   `401 Unauthorized` is returned.
4. If the Redis key is absent (family never issued or already deleted), `401`
   is returned.

**Logout.** `POST /api/auth/logout` calls `revokeRefresh`, which deletes the
family key from Redis and clears both cookies via `Set-Cookie` with
`Max-Age=0`.

**Algorithm pin.** Both the access and refresh JWT strategies reject tokens
signed with any algorithm other than `HS256` (`algorithms: ['HS256']` in the
strategy options), preventing algorithm-confusion attacks.

**Non-enumerable register.** `UsersService.create` now returns a decoy result
(a locally constructed `User`-shaped object with a fresh UUID and current
timestamp) when a duplicate email is detected, instead of throwing a 409.
The caller's response is indistinguishable from a successful registration,
preventing account enumeration via the register endpoint.

## Alternatives Considered

- **Return tokens in the body and let the SPA store them:** simpler server
  implementation but leaves tokens in JavaScript-accessible storage and
  provides no revocation path.
- **Server-side session store (e.g. Redis-backed express-session):** would also
  remove XSS exposure, but requires a session lookup on every authenticated
  request rather than a stateless JWT verification. The current approach only
  hits Redis on refresh rotation, not on every access.
- **Revoke by jti alone (no family):** would detect replay after a rotation but
  could not revoke the whole chain. Using a family ID allows a single Redis key
  per token family regardless of how many rotations have occurred.
- **Throw 409 on duplicate register:** simpler and conventional, but allows an
  attacker to enumerate existing accounts by observing the distinct error
  response.

## Consequences

- Browser clients are no longer required to manage token storage; the browser
  handles cookies automatically.
- CLI and test clients can still use `Authorization: Bearer` as a fallback; no
  existing integration is broken.
- A Redis outage now causes `rotateRefresh` and `revokeRefresh` to return 503
  rather than silently succeeding. This is a fail-closed trade-off: availability
  is reduced in exchange for eliminating silent security bypasses.
- The `REDIS_PASSWORD` environment variable must be set; the API (and Redis
  itself) refuse to start without it (see ADR 0012).
- The register endpoint no longer reveals whether an email is already
  registered. Legitimate users who try to register a duplicate email will not
  receive a 409; they should use the login flow instead.
