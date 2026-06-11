# 0012 - API and Infrastructure Security Hardening

**Status:** Accepted

## Context

Several low-hanging security issues were identified in the API, nginx
configuration, and Kubernetes manifests:

1. **Unauthenticated datastores.** Redis (both compose and k8s) had no
   `requirepass` set; ClickHouse used the default `default` user with no
   password; the API fell back to the hardcoded password `"postgres"` when
   `DB_PASS` was absent. Any process that could reach the Redis or ClickHouse
   port had full access.

2. **No rate limiting.** Auth endpoints (login, register, refresh) and the
   redirect hot path had no per-IP throttle. Brute-force credential stuffing
   and redirect-abuse traffic were unbounded.

3. **SQL injection surface in analytics.** `stats.service.ts` interpolated the
   slug directly into ClickHouse query strings, escaping single quotes manually
   with a local `escapeSlug` function. ClickHouse's `query_params` binding
   mechanism makes string interpolation unnecessary.

4. **SSRF via link creation.** `POST /api/urls` accepted any syntactically
   valid URL, including `http://169.254.169.254/` and private ranges. A
   shortened link could be used to probe internal services.

5. **No security response headers.** Neither nginx (compose nor k8s) nor the
   API set `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, or
   `Content-Security-Policy`. Server version tokens were not suppressed.

6. **Incorrect trust-proxy configuration.** The NestJS app did not call
   `app.set('trust proxy', N)`, so `req.ip` reflected the socket address
   (the nginx container) rather than the real client IP. Rate limiting and
   per-IP analytics would have counted all traffic as a single IP.

7. **Trace-header leakage.** The SPA's `FetchInstrumentation` propagated
   `traceparent` to all URLs (`propagateTraceHeaderCorsUrls: [/.*/]`),
   potentially leaking internal trace IDs to third-party hosts.

8. **Swagger UI in production.** The OpenAPI / Swagger UI was mounted
   unconditionally, disclosing the full API schema in the production environment.

## Decision

Address all of the above:

**Datastore authentication.**
- Redis: `--requirepass $(REDIS_PASSWORD)` and `--masterauth $(REDIS_PASSWORD)`
  in k8s `StatefulSet` args; `REDIS_PASSWORD` secret injected via env var.
  Liveness/readiness probes updated to authenticate (`REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli ping`).
- ClickHouse: `users.xml` (both compose and k8s `ConfigMap`) creates a named
  user with a SHA-256 password hash and removes default-user access; the API's
  `ClickHouseService` reads credentials from env vars.
- Postgres: `buildTypeOrmOptions` calls `configService.getOrThrow('DB_PASS')`
  — the API now refuses to boot when `DB_PASS` is absent instead of falling
  back to `"postgres"`.

**Rate limiting.**
`ThrottlerModule` is configured in `app.module.ts` with three named throttlers:
`default` (300 req/min), `auth` (30 req/min — applied to login, register, and
refresh via `@Throttle({ auth: {...} })`), and `redirect` (120 req/10 s — applied
to the redirect hot path). Counters are in-memory per pod.

**Parameterized ClickHouse queries.**
`stats.service.ts` replaces the four query-builder functions (which used string
interpolation and a manual `escapeSlug`) with four static template strings
using the `{slug:String}` placeholder, and passes `{ slug: shortUrl }` as
`query_params`. The ClickHouse client handles quoting; no application-level
escaping is needed or present.

**SSRF rejection.**
`apps/api/src/links/dto/is-public-http-url.validator.ts` implements
`IsPublicHttpUrlConstraint`, which uses `ipaddr.js` to reject URLs whose host
is a private, loopback, link-local, or unspecified IP address (IPv4 and IPv6,
including IPv4-mapped IPv6). Applied to the `url` field of `CreateLinkDto` via
the `@IsPublicHttpUrl` decorator. DNS-based SSRF (hostnames that resolve to
private IPs at runtime) is explicitly out of scope for this static check.

**Security headers.**
nginx (`nginx/nginx.conf` and `k8s/base/web/configmap-nginx.yaml`) sets
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin`, and a `Content-Security-Policy`
in every location block (repeated per block to comply with nginx's inheritance
rules for `add_header`). `server_tokens off` suppresses version disclosure.
The NestJS API (`main.ts`) mounts `helmet` with `hsts: false` (HSTS is handled
by the k8s production overlay) and `x-powered-by` disabled.

**Trust proxy.**
`main.ts` calls `expressApp.set('trust proxy', trustProxyHops)` before any
middleware or guard runs. The default is `1` (one nginx hop in compose); k8s
sets `TRUST_PROXY_HOPS=2` (Traefik + web-nginx) via the API Deployment env.

**Trace-origin restriction.**
`instrumentation.ts` in the SPA restricts `propagateTraceHeaderCorsUrls` to a
pattern matching the same origin as `window.location.origin`. `traceparent`
headers are no longer sent to cross-origin requests.

**Swagger UI gating.**
`main.ts` wraps `mountSwagger` in `if (!isProd)`. In production (`NODE_ENV=production`)
the Swagger UI and OpenAPI JSON endpoints are not mounted.

## Alternatives Considered

- **Redis without a password in the cluster (rely on NetworkPolicy alone):**
  network policies reduce exposure but do not prevent access from any pod that
  legitimately needs Redis. A password is a second, independent layer.
- **Application-level escaping for ClickHouse queries:** the existing
  `escapeSlug` function escaped only single quotes; other injection vectors
  (e.g. comment sequences) are not handled. Parameterized queries remove the
  entire class of risk.
- **Block all private hostnames (including DNS-resolved ones) for SSRF:**
  requires a DNS lookup at request time, introducing latency and a dependency on
  DNS availability. Deferred; the current check blocks the most common literal-IP
  probing patterns.
- **Rate limiting backed by Redis:** would provide accurate cross-pod counters
  but adds Redis dependency to the throttle path. In-memory counters per pod
  are sufficient for the current single-pod deployment and avoid a Redis
  availability dependency on every request.

## Consequences

- **Operator follow-up required:** the cluster's private network CIDR
  (`10.43.0.0/16` placeholder in `k8s/cluster/hetzner-k3s.yaml`) must be
  replaced with the actual k3s pod CIDR before applying to the cluster.
- Redis, ClickHouse, and Postgres now require credentials. The `REDIS_PASSWORD`
  and ClickHouse password env vars must be added to `mikrouli-secrets` before
  deploying the updated manifests.
- In-memory rate-limit counters reset on pod restart and do not synchronise
  across pods. Horizontal scaling would require a Redis-backed throttle store.
- The Swagger UI is no longer accessible in production. Developers must run the
  stack locally (`NODE_ENV` not set to `production`) to access it.
- HSTS (`Strict-Transport-Security`) is intentionally absent from the API-layer
  helmet config; it is applied by the k8s production ingress overlay
  (`k8s/overlays/production/hsts-middleware.yaml`).
