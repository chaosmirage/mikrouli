# api-keys

## Purpose

Owns API-key authentication and the request-admission guards that front every
protected API route. Combines the hashed API-key persistence layer (the
`api_keys` table) with the NestJS guards that choose between JWT, API-key, and
Guest admission on each controller method.

## Key pieces

- `api-key.entity.ts` -- `api_keys` table. Stores the key hash (never the
  plaintext), the user-facing prefix, the owning user, and the revoked flag.
  `ON DELETE CASCADE` mirrors `provider_accounts`: deleting a user removes
  their keys.
- `api-keys.service.ts` -- `ApiKeysService`: issues, lists, and revokes keys.
  On creation it returns the plaintext key exactly once to the caller; only
  the hash is persisted.
- `api-keys.controller.ts` -- REST endpoints under `/api/api-keys` for
  issuing, listing, and revoking keys. JWT/cookie-guarded (no Guest access).
- `api-key-auth.guard.ts` -- `ApiKeyAuthGuard`. Reads the `x-api-key` header,
  looks up the hash, and populates `req.user` on a match. Used by
  `BearerOrApiKeyGuard` as one of its two strategies.
- `bearer-or-api-key.guard.ts` -- `BearerOrApiKeyGuard`. The default
  registered-user admission guard. Picks the auth method from the request
  (`Bearer` -> JWT, `x-api-key` -> API key, `mikrouli_access` cookie -> JWT)
  and delegates to the matching strategy. Throws `UnauthorizedException` when
  no credential is present; rendered as RFC 9457 by `ProblemDetailsFilter`.
- `guest-or-authenticated.guard.ts` -- `GuestOrAuthenticatedGuard`. The
  single choke-point for Guest admission on `LinksController.create`. Three
  branches, in order: (1) a credential is present -> delegate to
  `BearerOrApiKeyGuard` unchanged; (2) no credential AND
  `GUEST_SHORTEN_ENABLED=true` (read per request via `ConfigService`, never
  trusted from a cached SPA hint) AND the request originates from the SPA
  (the `Origin` or `Referer` hostname matches the server's hostname derived
  from `PUBLIC_BASE_URL` and the `Host` header) -> resolve the Guest row via
  `UsersService.getGuestUserId()`, populate `req.user` with
  `{ id, isGuest: true }`, and admit; (3) otherwise -> throw
  `UnauthorizedException`. Hostnames are compared, not full origins, because
  nginx `$host` strips the port. Curl, scripts, and bots (no browser
  `Origin`/`Referer` or a non-matching one) are refused and directed to the
  API-key path.
- `api-keys.module.ts` -- exports the service, guards, and `TypeOrmModule`
  for `ApiKey`; consumed by feature modules that need admission guards.

## How to extend safely

- Per-method guards, not a single class-level guard, are the convention on
  controllers with mixed admission policy (see `LinksController`). When a new
  method needs a different admission policy from the controller default, drop
  the class-level `@UseGuards` and annotate each method with its own.
- `BearerOrApiKeyGuard` must remain the only path for registered users; do
  not bypass it with direct JWT/API-key strategy calls on a controller that
  accepts credentials. New admission policies belong in a new guard that
  delegates to `BearerOrApiKeyGuard` when a credential is present (mirroring
  `GuestOrAuthenticatedGuard`).
- The Guest branch must re-read `GUEST_SHORTEN_ENABLED` on every request via
  `ConfigService`. Do not cache the flag in the guard; a client that cached
  the SPA's flag-on value before the operator flipped it must still be
  refused server-side.
- The Guest branch is browser-only by design: it exists for the SPA's
  landing-page shorten form. Do not relax the `Origin`/`Referer` hostname
  check to admit non-browser clients -- those must use an API key or JWT.
- The plaintext API key is returned exactly once on creation; never persist
  it, log it, or echo it from a list endpoint.
