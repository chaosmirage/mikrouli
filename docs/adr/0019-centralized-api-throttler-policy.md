# 0019. Centralized API Throttler Policy

## Status

Accepted

## Context

The named throttler names (`auth`, `redirect`) were defined in
`app.module.ts` and exported from it, then imported back by the auth and
redirect controllers for their `@Throttle` decorators. That shape is an
import cycle: when the controller module evaluates its decorators, the
app-module binding is not yet initialized, so the imported name resolves to
`undefined` at decorator time. Every named `@Throttle({ [name]: ... })`
override therefore matched no declared throttler and silently no-opped,
while the module-level `auth` value (30 req/min, intended as a strict
credential-entry limit) was evaluated for every route through the
min-over-names rule — taxing data traffic that was never meant to carry it.

The policy also had no single home: budgets and names lived beside the
module wiring, and the specs could not boot exactly the policy the app
boots.

## Decision

Rate limiting is governed by a single policy leaf,
`apps/api/src/common/throttler-policy.ts`, which imports only
`@nestjs/throttler` types. Because the leaf cannot import controllers, the
decorator-time cycle that silently disabled named overrides is impossible by
construction. It exports the throttler names, every designed budget, and
`buildThrottlerOptions()`; `app.module.ts` boots the module with that
builder and the guard-driven specs consume the same object, so the test
fixture cannot drift from the deployed policy.

The policy is shaped fail-safe around the governing mechanic of
`@nestjs/throttler` 6.x `ThrottlerGuard`: every declared throttler is
evaluated for every route and a route's effective budget is the minimum
over all non-skipped names. `@Throttle` replaces one name's budget on that
route; `@SkipThrottle({ name: true })` sheds one name (a bare
`@SkipThrottle()` skips only `default`).

- **Liberal module floors** bound any route that declares nothing of its
  own: `default` 300 req/min, `auth` 300 req/min (equal to the default so
  it never taxes non-auth routes through the min rule — it exists for
  route-level tightening), `redirect` 120 req/10 s, `data` 1000 req/min.
- **Route-level tightenings** where the attack surface is: credential entry
  (register, login, refresh, GitHub sign-in and callback) gets 10 req/min
  per IP; anonymous link creation gets 30 req/min per IP — guest
  `POST /api/urls` skips the per-user quota check and its origin check is
  spoofable, so this per-IP override is the only abuse bound on that route.
- **Skip-to-select**: authenticated data routes explicitly skip the other
  declared names so the generous `data` budget alone governs them.

A future route that forgets a skip degrades to the liberal floor; one that
forgets a tightening still gets the floor — never an unbounded route.

Counters remain in-memory per pod; effective budgets multiply by pod count.

This decision supersedes the "Rate limiting" mechanics described in ADR
0012 (three named throttlers configured in `app.module.ts`). ADR 0012's
other hardening measures are unaffected.

## Alternatives considered

**Keep the names in `app.module.ts`.** The prior shape: one module both
provides the module options and is imported by the controllers it
throttles. It is exactly the cycle that made the named overrides silently
no-op, and it leaves budgets beside bootstrap wiring with no leaf to test
against.

**Redis-backed counters.** Would give accurate cross-pod limits but adds a
Redis dependency to the throttle path of every request; in-memory per-pod
counters are retained for the current single-pod deployment (the trade-off
ADR 0012 already recorded).

**Per-route declarations with no module floors.** A route that forgets to
declare anything would be unbounded; the fail-safe shaping exists to make
forgetting degrade to a liberal bound instead.

## Consequences

- Every rate budget lives in one file; changing a budget is a one-place
  change verified by the guard-driven specs
  (`apps/api/src/common/throttler-policy.spec.ts`), which drive the real
  `ThrottlerGuard` over `buildThrottlerOptions()`.
- Adding a route now means choosing its tightening or skips explicitly.
  Because every non-skipped name applies, an accidental combination (for
  example a route that tightens `auth` but does not skip `redirect`) yields
  the stricter budget — visible in the policy file rather than spread across
  controllers.
- In-memory counters reset on pod restart and do not synchronise across
  pods; horizontal scaling would still require a Redis-backed throttle
  store.
