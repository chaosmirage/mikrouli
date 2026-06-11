# redirect

## Purpose

Handles the hot-path slug-to-URL resolution and HTTP redirect. Resolves slugs
from a Redis cache (falling back to PostgreSQL), guards against non-http schemes
stored in older rows, and records the click fire-and-forget. Rate-limited to
prevent abuse.

## Key pieces

- `redirect.controller.ts` -- `GET /:slug`. Validates slug length (exactly 6
  characters), resolves via `RedirectService`, records stats, and issues a 302.
  Throttled via the `REDIRECT_THROTTLE_NAME` bucket (120 req / 10 s). Reads the
  client IP via `req.ip`, which is accurate only when `trust proxy` is correctly
  set in `main.ts`.
- `redirect.service.ts` -- `RedirectService`. Cache-first resolution using
  `LinkCacheService`, falling back to a database lookup via `LinksService`. Both
  the cached value and the database value pass through `hasHttpScheme` before
  being returned as active: any stored URL with a non-http(s) scheme resolves to
  `not-found` so no javascript: or data: URLs can be served.
- `redirect.module.ts` -- wires the module.

## How to extend safely

- `hasHttpScheme` is the SSRF guard at the resolve layer. It must be applied to
  every code path that returns a URL for redirection (both the cache hit and the
  DB hit paths). Do not add a fast-path that skips this check.
- The trust-proxy hop count is set once in `main.ts` (`TRUST_PROXY_HOPS` env
  var, default 1 for the single nginx hop in compose). A misconfigured hop count
  causes `req.ip` to return the wrong address; always test with a real reverse
  proxy rather than direct connections when changing the count.
- Stats recording uses `void stats.record(...)` -- failures are logged in
  `StatsService` and do not affect the redirect response.
- Slug validation (`rejectInvalidSlug`) enforces exactly 6 characters, matching
  the nginx regex and the link-creation service. Do not relax this check without
  updating all three sites.
