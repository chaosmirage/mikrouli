# 0020. Actor-Aware Throttle Budgets

## Status

Accepted

## Context

ADR 0019 centralized the API's rate-limit policy and shaped it fail-safe:
liberal module floors, route-level tightenings where the attack surface is, and
skip-to-select so authenticated data routes run under the generous `data`
budget alone. Two of those tightenings were declared statically, so they
applied to every caller of their route regardless of actor:

- Anonymous link creation (`POST /api/urls`) is bounded by `GUEST_CREATE_BUDGET`
  (30 req/min per IP) because a guest creation skips the per-user quota check
  and the browser-origin check is spoofable. The bound is the only abuse bound
  on that route for the anonymous visitor, but it also counted against the
  registered user behind the same route, whose quota-checked creations were
  refused once they exceeded a guest-sized budget.
- Session rotation (`POST /api/auth/refresh`) shared `AUTH_CREDENTIAL_BUDGET`
  (10 req/min per IP) with register and login. That bound exists to make
  password brute force slow; rotation instead presents a server-issued
  HttpOnly cookie. A burst of failed sign-ins from one address consumed the
  same counter, so every session behind that address lost the ability to stay
  signed in.

`@SkipThrottle` is static and cannot distinguish actors, and the throttler
guard runs before authentication populates `req.user`, so per-actor selection
had no expression in the declarative surface.

## Decision

Rate-limit budgets that exist to bound anonymous (guest) admission are declared
guest-only: a request carrying a credential is not a guest and never pays the
guest bound.

- The app boots `CredentialedRequestThrottlerGuard`
  (`apps/api/src/common/credentialed-request-throttler.guard.ts`) as its global
  throttler guard. It is identical to `ThrottlerGuard` except that names marked
  with `@SkipThrottleWhenCredentialed({ name: true })` are neither counted
  against nor enforced when the request carries a credential. A skipped name
  consumes no counter slot, so credentialed traffic cannot exhaust the guest
  bound for anyone else.
- Actor type is read from the raw request by `carriesApiCredential`
  (`apps/api/src/common/credential-presence.ts`): presence of a Bearer access
  token, an `x-api-key` header, or the `mikrouli_access` session cookie. The
  predicate detects presence only; validity is decided later by the auth
  guards. `GuestOrAuthenticatedGuard` calls the same predicate for guest
  admission, so admission and rate limiting branch on the same actor verdict.
- `POST /api/urls` keeps `GUEST_CREATE_BUDGET` for the anonymous visitor and
  declares `@SkipThrottleWhenCredentialed` for the three public names
  (`default`, `auth`, `redirect`), so a credentialed creation runs under the
  `data` budget (1000 req/min) exactly like the route's other authenticated
  operations, quota-checked as usual.
- `POST /api/auth/refresh` gets its own rotation budget,
  `AUTH_REFRESH_BUDGET` (60 req/min per IP), instead of sharing the
  credential-entry bound. The access token lives 15 minutes
  (`ACCESS_TOKEN_TTL = '15m'` in `apps/api/src/auth/auth.module.ts`), so many
  sessions behind one address rotate a handful of times per minute at most.

The names and budgets remain in the `throttler-policy.ts` leaf; this decision
adds the per-request actor dimension on top of ADR 0019's centralized policy,
which is otherwise unchanged.

## Alternatives considered

**Leave the tightenings static (the prior state).** One decorator per route and
no new machinery, but a budget sized for an anonymous abuser taxed the
registered user behind the same route, and a locked-out login window took
rotation down with it.

**Unconditional `@SkipThrottle` on guest-admissible routes.** Sheds the bound
for everyone, including the anonymous visitor the bound exists for; the only
abuse bound on anonymous creation would be gone.

**Keying budgets on the authenticated user.** The throttler guard runs before
authentication populates `req.user`, so per-user limits would require moving
rate limiting behind the auth guards or duplicating their work. Presence
detection on the raw request is enough to separate guest from credentialed.

## Consequences

- A credentialed `POST /api/urls` is bounded by the `data` budget alone and
  stays available past the guest bound. The guard-driven specs
  (`apps/api/src/common/throttler-policy.spec.ts`) drive the booted guard over
  the real controllers' metadata for all three credential forms (session
  cookie, Bearer token, API key) and assert the public names emit no counter
  header, that rotation denies at its own budget, and that exhausting the
  credential-entry budget on login leaves rotation available.
- `POST /api/auth/refresh` keeps an independent counter: scripted rotation
  stays bounded at 60 req/min per IP while a brute-forced login window cannot
  lock every session behind one address.
- A forged credential sheds the guest bound but buys nothing: presence alone
  routes the request to the auth guards, which refuse it before anything is
  created.
- The `mikrouli_access` cookie name is restated in `credential-presence.ts`
  rather than imported from the auth module, keeping that leaf free of the
  feature graph — the same import-cycle shape ADR 0019 exists to prevent.
- Counters remain in-memory per pod; the actor split changes which counter a
  request touches, not the cross-pod trade-off ADR 0019 recorded.
