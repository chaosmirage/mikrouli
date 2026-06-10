# 0007 - Dual Authentication: JWT Sessions and Bcrypt-Hashed API Keys

**Status:** Accepted

## Context

The API has two distinct client types with different authentication needs:

- **Browser SPA users** authenticate once with email + password and expect a
  session-like experience. A short-lived access token with a longer-lived
  refresh token is the standard pattern for this use case.
- **Programmatic clients** (scripts, integrations) need a stable credential
  they can store and reuse without an interactive login flow. A long-lived
  opaque key passed in a header is the conventional choice.

Using only JWT for programmatic clients is awkward: JWTs have expiry and require
a refresh mechanism that does not fit non-interactive workflows. Using only API
keys for browser clients requires the SPA to store a long-lived credential,
which is harder to revoke than a short-lived JWT.

Evidence:
- `apps/api/src/auth/jwt.strategy.ts`: Passport JWT strategy extracts the
  bearer token from the `Authorization` header; `apps/api/src/auth/auth.service.ts`
  issues access + refresh token pairs using `bcrypt` for password hashing.
- `apps/api/src/api-keys/api-keys.service.ts`: API keys are hashed with bcrypt
  before storage; plaintext is returned only at creation time and is never stored.
- `apps/api/src/api-keys/bearer-or-api-key.guard.ts`: the `BearerOrApiKeyGuard`
  inspects the request headers and routes to the JWT guard when an `Authorization:
  Bearer` header is present, or to the API key guard when `X-Api-Key` is present.

## Decision

Support two authentication methods behind a single guard:

- **JWT bearer tokens** for SPA users. `auth.service.ts` issues access tokens
  (short-lived) and refresh tokens (7-day, separate secret). Passwords and
  refresh tokens are verified with bcrypt. The JWT strategy validates the
  `Authorization: Bearer <token>` header.
- **Bcrypt-hashed API keys** for programmatic clients. Keys are generated as
  random plaintexts, hashed with bcrypt before storage, and verified on each
  request via constant-time comparison. The `X-Api-Key` header carries the
  plaintext on each request.

The `BearerOrApiKeyGuard` selects the appropriate guard based on which header is
present in the request, making the choice transparent to individual route handlers.

## Alternatives Considered

- **JWT-only authentication:** clients store a token with an expiry and must
  handle refresh flows. For programmatic clients this adds unnecessary complexity
  and a dependency on a refresh endpoint.
- **API-key-only authentication:** simpler, but provides no short-lived credential
  mechanism for the SPA. All browser sessions would need to store a long-lived
  secret.
- **OAuth2 / OIDC via an external provider:** correct for multi-tenant or
  federated identity, but significantly increases complexity and adds an external
  dependency for a single-tenant application.
- **Storing API key plaintexts:** avoids the bcrypt comparison cost per request
  but means a database breach exposes all API keys directly. Bcrypt is the
  standard mitigation.

## Consequences

- Browser clients get short-lived, revocable JWTs with a refresh mechanism.
- Programmatic clients get stable, long-lived API keys without a refresh flow.
- A bcrypt comparison on every API-key-authenticated request adds a fixed cost
  (tens of milliseconds); this is intentional and resists timing attacks.
- API key plaintexts are displayed once at creation and then unrecoverable from
  the database, which is consistent with the industry standard for API key UX.
