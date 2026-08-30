# common

## Purpose

Shared utilities that every API module relies on: request correlation,
structured error responses, the API's rate-limit policy, and type
definitions used across controllers, guards, and services.

## Key pieces

- `correlation-id.ts` -- AsyncLocalStorage store for the per-request
  correlation ID. `getCorrelationId()` returns the ID (or undefined outside
  a request context). Every layer that needs the ID (logging, error filter,
  tracing) reads it from this single store.
- `correlation-id.middleware.ts` -- NestJS middleware registered on all
  routes (`*`). Reads `X-Correlation-ID` (or `X-Request-ID`) from the
  incoming request header; generates a UUID v4 when absent. Sets the
  response header and runs the rest of the request inside the async-local
  store so downstream code sees the ID.
- `correlation-id.logger.ts` -- `CorrelationIdLogger` extends the NestJS
  `ConsoleLogger`. Prepends `[cid:<id>]` to every log line when a
  correlation ID is active, so structured logs are traceable end-to-end.
- `problem-details.filter.ts` -- Global `ExceptionFilter` that maps every
  unhandled exception to an RFC 9457 problem-details response. Sets
  `Content-Type: application/problem+json` and also writes the
  `X-Correlation-ID` response header from the async-local store so error
  responses are traceable.
- `problem-details.ts` -- Pure helpers that build the `ProblemDetails`
  payload (type URI, title, status, optional errors array). No framework
  dependency.
- `authenticated-request.ts` -- Type alias for the Express request when the
  user has been authenticated by the JWT guard. Carries an optional `isGuest`
  flag on `req.user`; set to `true` by `GuestOrAuthenticatedGuard` on the
  anonymous shorten path so downstream code can branch on actor type without
  re-reading the guard state.
- `constants.ts` -- cross-cutting scalar constants shared by multiple
  modules. `GLOBAL_LINK_LIMIT`, `GLOBAL_KEY_LIMIT`, and `RETENTION_MS` drive
  quota and retention behaviour. `GUEST_SENTINEL_EMAIL` is the deterministic
  email of the single shared Guest pseudo-identity row; it is read by both
  the `SeedGuestUser` migration and `UsersService.getGuestUserId()` so the
  sentinel stays stable across deploys. Add a constant here only when at
  least two unrelated modules must agree on the same value.
- `throttler-policy.ts` (+ `throttler-policy.spec.ts`) -- single source of
  truth for the API's rate-limit policy: the four throttler names
  (`default`, `auth`, `redirect`, `data`), every designed budget (liberal
  module floors plus the route-level tightenings for credential entry,
  session rotation, the redirect hot path, and anonymous creation), and
  `buildThrottlerOptions()`, which `app.module.ts` boots the global
  `ThrottlerGuard` with. A deliberate import-free leaf (only
  `@nestjs/throttler` types) so controllers can import the names without
  cycling back through the module graph; the colocated spec drives the real
  guard with these options against the real controllers' handler metadata
  and asserts allow/deny plus the emitted `X-RateLimit-*` headers.
- `credential-presence.ts` -- the single answer to "does this request carry
  any credential the API recognises" (Bearer token, API key, session access
  cookie). Guest admission (`GuestOrAuthenticatedGuard`) and the throttler
  guard both branch on actor type before authentication runs, so they must
  reach the same verdict from the raw request; both call this predicate.
- `credentialed-request-throttler.guard.ts` (+ colocated spec in
  `throttler-policy.spec.ts`) -- the `ThrottlerGuard` subclass the app boots
  globally. It realises `@SkipThrottleWhenCredentialed({ name: true })`: a
  route declares a named budget that must not be counted against or enforced
  on credentialed requests (the guest-admission bound on `POST /api/urls`).
  Skipped names consume no counter slot, so registered traffic cannot
  exhaust the guest bound for anyone else.

## How to extend safely

- The correlation ID flows through AsyncLocalStorage, never through
  explicit parameters. Any new code that needs the ID calls
  `getCorrelationId()` from `correlation-id.ts`. Do not pass the ID as a
  function argument through service layers.
- To add a new exception type to the problem-details filter, add a new
  `instanceof` branch in `dispatchProblem`. Always set the
  `X-Correlation-ID` header on the response before calling `sendProblem`.
- Keep correlation-id middleware first in the middleware chain (registered
  via `AppModule.configure`). If a new middleware needs the correlation ID,
  register it after `CorrelationIdMiddleware`.
- Do not import NestJS-specific types in `correlation-id.ts` or
  `problem-details.ts` -- those files stay framework-free so they can be
  tested without pulling in the full NestJS module graph.
