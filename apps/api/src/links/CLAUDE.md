# links

## Purpose

Owns the link-shortening REST API under `/api/urls`. Handles creation (with
slug collision retry and transactional outbox dispatch), per-user listing,
slug deletion, and destination-URL editing, plus the Guest variant of
creation used by the landing-page anonymous shorten form.

## Key pieces

- `links.controller.ts` -- `LinksController`. Uses per-method `@UseGuards`
  rather than a class-level guard because the admission policy differs by
  method: `POST /` is fronted by `GuestOrAuthenticatedGuard` (anonymous
  visitors admitted when `GUEST_SHORTEN_ENABLED=true` and the request
  originates from the SPA), while `GET /` and `DELETE /:slug` stay behind
  `BearerOrApiKeyGuard` (registered users only). The controller branches on
  `req.user.isGuest` and calls either `LinksService.create` or
  `LinksService.createGuest`, keeping the service actor-agnostic except for
  the quota-skip path. Rate limits are selected per route from
  `common/throttler-policy.ts`: `POST /` pins the per-IP
  `GUEST_CREATE_BUDGET` override (the deliberate bound on anonymous
  creation), while `GET /`, `DELETE /:slug`, and `PATCH /:slug` shed the
  three public throttle names via `@SkipThrottle` so authenticated traffic
  runs under the generous `data` budget alone. Responses are mapped through `toPublicLinkSchema`
  before being returned; errors flow to `ProblemDetailsFilter` as RFC 9457
  problem-details. `PATCH /:slug` (`update`) is behind `BearerOrApiKeyGuard`
  like list/remove; it calls `LinksService.updateDestination`, then
  write-through-caches the new destination via `LinkCacheService.set` --
  or evicts the key via `LinkCacheService.del` when the link's `expiresAt`
  is already in the past -- so the redirect hot path never serves a stale
  cached destination.
- `links.service.ts` -- `LinksService`:
  - `create(url, userId, expiresAt?)` -- registered-user creation. Runs the
    per-user quota check, resolves expiry, then enters the
    slug-insert-outbox chain with `retryOnSlugConflict` (regenerates the slug
    on a `23505` collision and retries).
  - `createGuest(url, guestUserId, expiresAt?)` -- Guest variant. Reuses the
    slug-insert-outbox chain verbatim but skips the per-user quota check:
    quota is meaningless on the shared Guest row (one visitor could exhaust
    it for everyone); the deliberate per-IP `GUEST_CREATE_BUDGET` override
    declared in `common/throttler-policy.ts` and pinned on `POST /` in
    `links.controller.ts` is the only abuse bound on Guest. Owner of the new
    row is the shared Guest pseudo-identity resolved by
    `GuestOrAuthenticatedGuard`.
  - `listForUser(userId)`, `delete(slug, userId)` -- read/delete scoped to
    the calling user; Guest-origin calls never reach these (the guard
    refuses Guest on `GET`/`DELETE`).
  - `getOwnedLink(slug, userId)` -- private helper shared by `delete` and
    `updateDestination`: loads the link by slug, throws `NotFoundException`
    when it does not exist, then `ForbiddenException` when `link.userId`
    does not match the caller. Add any future ownership-gated mutation on
    top of this helper rather than re-deriving the not-found/forbidden
    check.
  - `updateDestination(slug, userId, url)` -- resolves and authorizes via
    `getOwnedLink`, then updates `originalUrl` scoped by both `shortUrl` and
    `userId` in the same `WHERE` clause (defense in depth against a
    check-then-act race), and returns the link with `originalUrl` already
    reflecting the new value.
- `slug-generator.service.ts` -- produces the 6-character slug used in the
  short URL and matched by the nginx `[A-Za-z0-9_]{6}` rewrite.
- `dto/` -- request DTOs and validators (see `dto/CLAUDE.md`).
- `entities/` -- `Link` entity definition.
- `links.module.ts` -- wires the service, controller, slug generator, and
  the cache dependency.

## How to extend safely

- Keep the controller thin: it should branch on `req.user.isGuest` and pick
  the service method, nothing more. New admission policies belong in a guard
  under `api-keys/`, not in a controller-side check.
- `createGuest` must never run a per-user quota check. Guest abuse bounds
  are per-IP rate limits declared in `common/throttler-policy.ts` and
  applied per route on the controller (today the `GUEST_CREATE_BUDGET`
  override on `POST /`), never the registered-user quota path -- the Guest
  row is shared across all anonymous visitors.
- The slug collision retry in `retryOnSlugConflict` is shared by both
  creation paths. Change it in one place; do not duplicate the retry loop in
  `createGuest`.
- Only `POST /` admits Guest traffic. If you expose a new mutation on this
  controller, front it with `BearerOrApiKeyGuard` explicitly; do not let it
  inherit a permissive default.
- Every creation path must dispatch the outbox event in the same
  transaction as the link insert; the cache populate happens after the
  transaction commits, in the controller, via `LinkCacheService.set`.
- Any mutation that changes `originalUrl` or expiry must update the Redis
  cache entry the redirect path reads (`LinkCacheService.set`), or evict it
  (`LinkCacheService.del`) when the link is already expired -- never leave a
  write path that lets the cache and PostgreSQL disagree on the destination.
- Reuse `getOwnedLink` for any new per-slug mutation that must be scoped to
  the calling user; do not re-implement the not-found/forbidden check.
