# Architecture Overview

mikrouli is a URL-shortener built as a production-grade service. This document
describes how the system is structured, the key design decisions embedded in the code, and
the honest trade-offs that come with them. Every claim here is verifiable against the
source files referenced in parentheses.

---

## 1. System topology

```
Internet
    |
    v
nginx :80 (public entry point)
    |
    +-- /:slug (6-char alphanumeric)  -->  NestJS API :3000  -->  Redis (cache hit)
    |                                                         -->  Postgres (cache miss)
    |
    +-- /api/*                        -->  NestJS API :3000
    |
    +-- /*                            -->  React/Vite SPA :8080
                                           (nginx-unprivileged static server)

NestJS API also writes to:
    Postgres  (links, users, api-keys, outbox)
    Redis     (redirect cache — primary + read-replica)
    ClickHouse (click analytics — stats / stats_buffer)
```

- **nginx** (`nginx/nginx.conf`, `docker-compose.yml`) is the single public entry point on
  port 8888 (compose) / 80 (Kubernetes). It passes the `X-Correlation-ID` request header through to the API so that per-request tracing survives the reverse-proxy hop. It routes 6-character slug paths directly to the
  NestJS API, `/api/*` to the API, and everything else to the React SPA.
- **NestJS API** (`apps/api`) handles all business logic: auth, link management, redirect
  resolution, click recording, and background cleanup.
- **React/Vite SPA** (`apps/web`) is a single-page application served as static assets;
  it communicates with the API through nginx.
- **Three backing stores** are described in section 3.

In Kubernetes (section 8) nginx is replaced by Traefik as the ingress controller;
the API and web workloads run as Kubernetes Deployments in the `mikrouli` namespace.

---

## 2. The two-path design

Every incoming redirect involves two distinct execution paths with different performance
and reliability requirements.

### Hot path: low-latency redirect

```
GET /:slug
  -> linkCache.get(slug)           [Redis, O(1)]
       hit  -> 302 to originalUrl  (sub-millisecond)
       miss -> Postgres SELECT      (linkCache.set on hit)
            -> 302 / 404 / 410
```

`RedirectService.resolve` (`apps/api/src/redirect/redirect.service.ts`) checks the Redis
cache first. On a miss it reads Postgres, populates the cache (TTL = min(time-to-expiry,
86 400 s)), and returns the result. Expired links return 410 Gone and are never cached.
The redirect itself is HTTP 302 (`redirect.controller.ts`; `REDIRECT_STATUS = 302`).

The cache is fronted by `LinkCacheService` (`apps/api/src/cache/link-cache.service.ts`),
which applies the `link:` key prefix and TTL capping. Redis is configured as a
primary-plus-replica pair (`redis-primary` / `redis-replica` in compose).

### Analytics path: columnar click recording

```
GET /:slug (after resolving)
  -> void stats.record(slug, ip, ua)   [fire-and-forget]
       -> ClickHouse stats_buffer INSERT
```

Click recording is **fire-and-forget**: `recordStatsIfActive` calls
`void stats.record(...)` so redirect latency never waits on the analytics insert
(`redirect.controller.ts`). Errors in `recordSafe` are caught, logged, and swallowed
(`stats.service.ts`). This means a ClickHouse outage degrades analytics only, not the
redirect hot path.

The insert target is `stats_buffer`, a Buffer-engine table that batches writes before
flushing to the underlying `stats` MergeTree table
(`clickhouse.service.ts`, `STATS_DDL`). Reads for the stats API query `stats_buffer`
directly so they include unflushed data.

---

## 3. Persistence: three stores and why

| Store | Role | Key entities |
|---|---|---|
| **Postgres 16** | Relational source of truth | `links`, `users`, `provider_accounts`, `api_keys`, `outbox` |
| **Redis 7** | Redirect cache (cache-aside) | `link:{slug}` -> original URL |
| **ClickHouse** | Columnar click analytics | `stats` (MergeTree), `stats_buffer` (Buffer) |

**Why Postgres for relational data.** Links, users, and API keys have relational
constraints (foreign keys, unique slugs) and require transactional writes. Link creation
uses a TypeORM transaction that atomically inserts the `Link` row and an `Outbox` record
in a single database transaction (`links.service.ts`, `insertLinkWithOutbox`). The outbox
pattern (`apps/api/src/outbox/entities/outbox.entity.ts`) makes link-creation events
durable even if downstream consumers are unavailable at creation time.

**Why Redis for the cache.** Redirect resolution is the highest-throughput path. Redis
provides sub-millisecond reads for cached slugs without hitting Postgres on every request.
The cache is populated on first miss, written through on destination edits
(`PATCH /api/urls/{slug}`, `links.controller.ts`), and invalidated explicitly on deletion
and expiry cleanup. A read-replica (`redis-replica --replicaof redis-primary`) is available
in compose for horizontal read scaling.

**Why ClickHouse for analytics.** Click data is append-only and query patterns are
aggregative (count by day, top browsers, top countries). MergeTree is purpose-built for
this: it partitions by month (`PARTITION BY toYYYYMM(timestamp)`), orders by
`(short_url, timestamp)` for efficient per-slug queries, and compresses columnar data far
better than row-oriented storage. The Buffer engine (`stats_buffer`) absorbs high-frequency
inserts without synchronous disk flushes on every click.

---

## 4. API contract: TypeSpec and RFC 9457

The API contract is defined in TypeSpec (`apps/api/spec/main.tsp`) and compiled to OpenAPI
3 (`apps/api/spec/tsp-output/`). The TypeSpec file is the **single source of truth** for
all request/response shapes; NestJS handlers are written to match it, not the other way
around. Adding or changing an endpoint means editing `main.tsp` first.

Error responses follow **RFC 9457 Problem Details** (`application/problem+json`).
Every error model in `main.tsp` spreads `ProblemDetails` (`type`, `title`, `status`,
`detail`, `instance`). The runtime implementation in `apps/api/src/common/problem-details.ts`
builds URIs in the form `https://mikrou.li/problems/{slug}` and
`problem-details.filter.ts` maps NestJS HTTP exceptions to this shape uniformly. Every error response also includes an `X-Correlation-ID` response header so callers can report the request-specific identifier for support lookup.

Endpoints covered by the spec: `POST /api/auth/register`, `POST /api/auth/login`,
`POST /api/auth/refresh`, `GET /api/auth/me`, `GET /api/auth/github`,
`GET /api/auth/github/callback`, `POST /api/urls`, `GET /api/urls`,
`PATCH /api/urls/{slug}`, `DELETE /api/urls/{slug}`, `GET /api/stats/{slug}`,
`POST /api/api-keys`, `GET /api/api-keys`, `DELETE /api/api-keys/{id}`,
`GET /api/usage`, `GET /api/health`, and the public redirect at `GET /{slug}`.

Short-link and API-key creation are bounded by a per-user monthly allowance
counted per calendar month (UTC): `POST /api/urls`, `POST /api/mcp`, and
`POST /api/api-keys` return `429 Too Many Requests` (RFC 9457) once the allowance
is reached. The default allowances are read from the `MONTHLY_LINK_LIMIT` and
`MONTHLY_KEY_LIMIT` environment variables (both default to the built-in constants
of 100 and 10 respectively when the variables are absent or invalid). An optional
nullable per-user override column on the user row takes precedence over the
environment-driven default when set (`apps/api/src/usage/usage.service.ts`).
`GET /api/usage` reports the current month's consumption, allowance, reset date,
and analytics retention window for the in-app usage page.

---

## 4a. MCP tool endpoint for LLM agents

The API exposes a Model Context Protocol (MCP) surface at `POST /api/mcp`
(`apps/api/src/mcp/mcp.controller.ts`) so LLM agents can create short links as a
native tool call instead of wrapping the REST endpoint by hand. It is a
Streamable-HTTP MCP server that registers a single tool, `create_short_link`,
which takes a target `url` and an optional ISO 8601 `expiresAt` and returns the
full usable short link as text plus `PublicLink` metadata in `structuredContent`.

- **Auth is API-key only.** The route is guarded by `ApiKeyAuthGuard`
  (`x-api-key` header). Cookie/JWT auth is deliberately excluded because a
  cookie-authenticated JSON-RPC POST is a CSRF-shaped risk. `GET` and `DELETE`
  return 405.
- **Stateless per request.** A fresh `McpServer` and
  `StreamableHTTPServerTransport` (`sessionIdGenerator: undefined`,
  `enableJsonResponse: true`) are created on each POST and closed when the
  response closes, so no credential or session state survives a request and the
  endpoint scales horizontally like the rest of the API.
- **Shared validation and error authority.** The tool handler
  (`apps/api/src/mcp/create-short-link.handler.ts`) re-validates input through the
  same `CreateLinkDto` (including the `@IsPublicHttpUrl` SSRF guard) the REST
  controller uses, then calls `LinksService.create` in process. Errors are mapped
  by `mapHttpExceptionToToolError` (`apps/api/src/mcp/mcp-error-mapper.ts`) through
  the same `buildProblemFromStatus` helper the RFC 9457 filter uses, so the MCP
  and REST paths report the same problems. Stack traces are never included.

A public Connect page in the SPA (`apps/web/src/pages/ConnectPage.tsx`) and a
served `llms.txt` (`apps/web/public/llms.txt`) document the REST and MCP surfaces
for agents and their authors.

---

## 5. Authentication

Two authentication mechanisms coexist, dispatched by `BearerOrApiKeyGuard`
(`apps/api/src/api-keys/bearer-or-api-key.guard.ts`):

- **JWT via HttpOnly cookies**: on login or refresh, `auth.service.ts` returns two
  `Set-Cookie` headers — `mikrouli_access` (short-lived, path `/api`) and
  `mikrouli_refresh` (7-day, path `/api/auth/refresh`). Both are `HttpOnly`,
  `Secure` (in production), and `SameSite=Strict`. The Passport JWT strategy
  (`jwt.strategy.ts`) uses an extractor chain: cookie first, then
  `Authorization: Bearer` as a fallback for CLI and test clients. Tokens are
  signed with `HS256` only; other algorithms are rejected before the validate
  callback runs.

- **Refresh-token revocation**: each `issueTokens` call generates a `jti` and
  a `family` UUID. The `jti` is stored in Redis under `refresh-family:<family>`
  (TTL = refresh token lifetime). On `rotateRefresh`, the stored `jti` must
  match the presented token's `jti`; a mismatch deletes the entire family from
  Redis (replay containment) and returns 401. Redis unavailability surfaces as
  503 (fail-closed). `POST /api/auth/logout` deletes the family key and clears
  both cookies.

- **API keys** (`X-Api-Key: <key>`): hashed with bcrypt (10 rounds) before
  storage (`api-keys.service.ts`). The raw key is shown once at creation and
  never stored in plaintext. Comparison is done against the stored hash on each
  request.

The guard inspects the incoming headers and delegates to the appropriate sub-guard; a
request with neither credential receives 401.

**GitHub OAuth sign-in**: in addition to email/password, users can sign in or
register with GitHub. `GET /api/auth/github` and `GET /api/auth/github/callback`
(`auth.controller.ts`) run the OAuth authorization-code flow via a Passport
strategy (`github.strategy.ts`):

- **Single-use CSRF state**: the strategy plugs a custom Redis-backed
  `passport-oauth2` `StateStore` (no `express-session` required). A 32-byte hex
  token (256 bits) is stored under `auth:oauth:state:<token>` with a 600 s TTL
  and validated with an atomic Redis `GETDEL` (`RedisService.getDelOrThrow`), so
  each state token is accepted at most once and concurrent callbacks cannot both
  pass. Redis errors fail the flow closed.
- **Verified-email gate**: `validate` fetches verified addresses from the GitHub
  `/user/emails` API and selects a verified email (primary preferred) *before*
  any account lookup; if none is verified the flow is refused. Only a thin
  `GithubIdentity` (`provider`, `providerUserId`, `email`) crosses into
  application code.
- **Account resolution**: `UsersService.findOrCreateFromProvider` runs a
  three-branch transaction — return the linked user, link the provider to an
  existing account matched by verified email, or create a new account with a
  null password — retried once on a unique-violation race. The resolved `User`
  reuses the same `issueTokens` path as credential login, so an OAuth session is
  identical to a password session.
- **Account links**: the `provider_accounts` table (`provider-account.entity.ts`,
  migration `1700000000004-GithubIdentities`) stores one row per
  `(provider, user)` with unique constraints on `(provider, provider_user_id)`
  and `(provider, user_id)`, enforcing one GitHub identity per account in the
  database. `ON DELETE CASCADE` removes a user's links when the user is deleted.
- **Typed failures**: OAuth failures use a fixed slug vocabulary
  (`github-no-verified-email`, `github-oauth-failed`); a route-scoped filter
  redirects them to `/login?error=<slug>` with no cookies, while any other error
  falls through to the global RFC 9457 filter (which now also maps
  slug-carrying problem payloads).

OAuth-only accounts have no password: `users.password_hash` is nullable
(`user.entity.ts`, typed `string | null`). `validateCredentials` runs
`bcrypt.compare` against a fixed decoy hash whenever the user is missing or has
a null password, keeping the failure response time constant so it cannot be used
to probe whether an account exists or lacks a password.

**Non-enumerable register**: `UsersService.create` returns a decoy result
(locally constructed, not persisted) on duplicate email rather than throwing
409, preventing account enumeration via the register endpoint.

---

## 6. Background work

### Transactional outbox

Every link creation writes an `Outbox` row atomically in the same Postgres transaction
as the `Link` row (`links.service.ts`, `insertLinkWithOutbox`). The outbox table
(`aggregate_type`, `payload`, `processed_at`) provides a durable event log; a consumer
can process events without risk of losing them to a mid-transaction crash. No outbox
processor is implemented in this repository -- the infrastructure is in place for a
future worker.

### Expired-link cleanup

`CleanupService` (`apps/api/src/cleanup/cleanup.service.ts`) runs hourly
(`CLEANUP_CRON = '0 * * * *'`), fetches up to 1 000 expired links from Postgres at a
time, deletes each from the database, and invalidates the Redis cache entry for the slug.
Per-item errors are caught and logged (`deleteOneSafely`) so a single failing deletion
does not abort the batch. Expired links that are accessed before cleanup are already
handled by the redirect path: `isExpired` in `redirect.service.ts` returns 410 Gone and
does not cache the response.

---

## 7. Observability

Both the API and the SPA ship OpenTelemetry instrumentation.

**API** (`apps/api/src/instrumentation.ts`): `NodeSDK` with
`getNodeAutoInstrumentations` (filesystem instrumentation disabled to reduce span noise).
OTLP/HTTP traces are exported to the endpoint configured by `OTEL_EXPORTER_OTLP_ENDPOINT`
(default `http://localhost:4318`; Jaeger is provided in compose at `:4318`/`:16686`).
A span processor sanitises PII before export: raw IP addresses and auth headers
(`authorization`, `x-api-key`, `cookie`, `set-cookie`) are redacted to `[REDACTED]`,
and credential query parameters (`token`, `api_key`, etc.) are blanked in URL attributes.
The service name is `mikrouli-api`.

**SPA** (`apps/web/src/instrumentation.ts`): `WebTracerProvider` with
`DocumentLoadInstrumentation`, `FetchInstrumentation`, and
`UserInteractionInstrumentation`. Sensitive headers are similarly redacted on fetch spans.
The service name is `mikrouli-web`. `propagateTraceHeaderCorsUrls` is restricted to a
pattern matching only the same origin as `window.location.origin`; `traceparent` headers
are not sent to cross-origin requests.

In Kubernetes the `OTEL_EXPORTER_OTLP_ENDPOINT` env var on the API Deployment points to
`http://otel-collector.observability.svc.cluster.local:4318`; operators supply their own
collector (Jaeger, Tempo, SigNoz, etc.) -- see `k8s/README.md`. The default in-cluster
backend is a single-replica Jaeger all-in-one (`k8s/observability/jaeger-deployment.yaml`)
that opens an on-disk Badger span store (`BADGER_EPHEMERAL=false`) on an `emptyDir` mounted
at `/badger/data`. Because Badger's startup and steady-state working set scale with the
retention window, memory sizing and span retention are sized together: the pod is granted a
256Mi request / 1Gi limit and `BADGER_SPAN_STORAGE_TTL` is capped at `24h` so the working
set stays inside the memory ceiling rather than OOM-killing the pod into a crashloop. The
pod runs under the `restricted` Pod Security Standard enforced on the `observability`
namespace.

---

## 8. Deployment

### API security controls

The following controls are applied at startup in `apps/api/src/main.ts`:

- **Trust proxy**: `app.set('trust proxy', N)` is called before any middleware.
  `N` defaults to `1` (one nginx hop in compose); the `TRUST_PROXY_HOPS` env var
  overrides it for k8s (set to `2` — Traefik + web-nginx).
- **Security headers**: `helmet` is mounted with `hsts: false` (HSTS is handled by
  the k8s production overlay) and `x-powered-by` disabled.
- **Cookie parser**: `cookieParser()` is registered before guards so the JWT strategy
  can extract tokens from `mikrouli_access`.
- **Swagger UI**: only mounted when `NODE_ENV` is not `"production"`, preventing API
  schema disclosure in the production environment.
- **Rate limiting**: the throttler policy (`apps/api/src/common/throttler-policy.ts`,
  a leaf that imports only `@nestjs/throttler` types) applies per-IP in-memory counters
  through four named budgets with liberal floors — `default` (300 req/min), `auth`
  (300 req/min, kept equal to the default so it only tightens at route level),
  `redirect` (120 req/10 s on the hot path), and `data` (1000 req/min, which
  authenticated data routes select by skipping the other names). Route-level
  tightenings cover credential entry (register, login, and GitHub sign-in at
  10 req/min per IP), session rotation (`POST /api/auth/refresh` at 60 req/min
  per IP), and anonymous link creation (30 req/min per IP — the only abuse
  bound on guest creation). Budgets that bound guest admission are guest-only:
  the app boots `CredentialedRequestThrottlerGuard`
  (`apps/api/src/common/credentialed-request-throttler.guard.ts`), so a
  credentialed request sheds the names its route marks with
  `@SkipThrottleWhenCredentialed` — on `POST /api/urls` a credentialed creation
  runs under the `data` budget like any other authenticated write. A route's
  effective budget is the minimum over all non-skipped names, so a route that
  forgets a declaration degrades to the liberal floor rather than running
  unbounded. See ADR 0019 and ADR 0020.

nginx (`nginx/nginx.conf`, `k8s/base/web/configmap-nginx.yaml`) sets
`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, and
`Content-Security-Policy` on every response, and suppresses server version disclosure
with `server_tokens off`. Dotfile paths are blocked; oversized User-Agent strings
(> 1 024 characters) return 400.

### Docker Compose (local / CI)

`docker-compose.yml` defines two mutually exclusive profiles:

- **prod** (default, selected via `COMPOSE_PROFILES=prod` in `.env`): nginx on `:8888`
  routes to the production-built React SPA and the NestJS API.
- **dev**: `nginx-dev` on `:8888` routes to a Vite HMR dev server with live
  source bind-mounts.

All services declare healthchecks. Named volumes (`postgres_data`, `clickhouse_data`)
persist data across `docker compose down`.

### Kubernetes (production on Hetzner)

The production cluster runs **k3s v1.29.4 on Hetzner Cloud** (`k8s/cluster/hetzner-k3s.yaml`),
provisioned with `hetzner-k3s`. The cluster consists of one cx22 control-plane node and
one cx22 worker, budgeted at under EUR 30/month (actual ~EUR 15.7).

Manifests are managed with **Kustomize**: `k8s/base/` contains the base resources;
`k8s/overlays/production/` applies the production patch and, critically, pins both
the API and web container images to an **exact git SHA**:

```yaml
# k8s/overlays/production/kustomization.yaml
images:
  - name: ghcr.io/chaosmirage/mikrouli-api
    newTag: GITSHA-PLACEHOLDER   # replaced by CI with ${{ github.sha }}
  - name: ghcr.io/chaosmirage/mikrouli-web
    newTag: GITSHA-PLACEHOLDER
```

Floating tags (`:latest`) are explicitly forbidden. CI replaces `GITSHA-PLACEHOLDER`
before `kubectl apply -k`.

**Manifest validation gate.** A `manifests` job in `.github/workflows/ci.yml` runs on
every pull request and validates the rendered bundles before they can reach the cluster.
It renders the `k8s/observability`, `k8s/base`, and `k8s/overlays/production` bundles with
`kubectl kustomize`, checks each result against the Kubernetes API schemas with
**kubeconform** (strict mode), and gates them through **Open Policy Agent** policies
(`k8s/policy/`, run with `conftest`). The Jaeger policy (`k8s/policy/jaeger.rego`) denies the
rendered Jaeger Deployment when its memory limit falls below 1Gi, its request below 256Mi,
its Badger TTL exceeds 24h, or any `restricted` Pod Security field
(`runAsNonRoot`, `readOnlyRootFilesystem`, `drop: [ALL]`, `seccompProfile: RuntimeDefault`)
is missing; quantities and durations are compared by parsed magnitude, so `1024Mi` and `1Gi`
are equal. The redis-replication policy (`k8s/policy/redis-replication.rego`, run over the
combined `k8s/base` and `k8s/overlays/production` renders) denies a bundle that lacks the
replica-to-primary replication edge — either the egress allowing replica pods to reach the
primary on TCP 6379 or the matching primary ingress — and rejects bare `redis`-scoped
selectors that would widen exposure. Each policy's own unit tests
(`k8s/policy/jaeger_test.rego`, `k8s/policy/redis_replication_test.rego`) run first. Because
the gate checks the same bundles the deploy workflow applies, a sizing, hardening, or
network-policy regression fails at review time instead of as a crashloop or a stalled
replica on the live cluster. See ADR 0016.

**Network policies** (`k8s/base/network-policies.yaml`) enforce a **default-deny-all**
posture in the `mikrouli` namespace. Explicit `NetworkPolicy` objects allow only the
required paths: Traefik ingress -> web, web -> API, API -> Postgres/Redis/ClickHouse, and
the Redis replica -> primary replication connection on TCP 6379 (a paired egress on the
replica and ingress on the primary, each scoped to the `app.kubernetes.io/component`
labels). No other east-west traffic is permitted.

Application secrets (`DB_PASS`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `REDIS_PASSWORD`,
the ClickHouse password, and the GitHub OAuth credentials `GITHUB_CLIENT_ID` /
`GITHUB_CLIENT_SECRET`) are stored in a Kubernetes `Secret` named `mikrouli-secrets`,
created manually by the operator from a trusted machine. The non-secret
`GITHUB_CALLBACK_URL` is set as a plain env value on the API Deployment. The CI/CD workflow never handles
plaintext credentials; the only secret it holds is `KUBECONFIG_PRODUCTION` for cluster
access.

**Operator follow-up**: the cluster private CIDR placeholder (`10.43.0.0/16`) in
`k8s/cluster/hetzner-k3s.yaml` must be replaced with the actual k3s pod CIDR before
applying the cluster manifests.

---

## 9. Known trade-offs and what I would do next

**Single-master Kubernetes control plane.** `schedule_workloads_on_masters: true` is
enabled in `hetzner-k3s.yaml` because the EUR 30 budget rules out a 3-master HA setup.
A control-plane node failure halts new deployments; running workloads continue via the
worker. Upgrading to HA requires switching to three `cpx11` nodes (~EUR 12.4/month) and
disabling `schedule_workloads_on_masters`.

**Fire-and-forget click recording can drop events.** If the ClickHouse insert fails (node
down, schema mismatch, network timeout), the error is logged and the click is lost.
`recordSafe` swallows the exception by design to protect redirect latency. A persistent
queue (e.g. a Kafka topic or the existing outbox table) would give at-least-once delivery
guarantees for analytics.

**Country and city resolution is not implemented.** `buildStatRow` in `stats.service.ts`
hardcodes `country_id: 0` (`"Unknown"`) and `city_id: 0` for every click. The ClickHouse
schema has `countries` and `cities` dimension tables seeded with a single "Unknown" row.
GeoIP lookup (e.g. MaxMind) would be required to populate them.

**UA parsing uses an id-table approach.** `ua-parser.ts` maps User-Agent strings to
integer IDs against a small static list of known browsers and OS names (Chrome, Firefox,
Safari, Edge, Opera; Windows, macOS, Linux, iOS, Android). Unrecognised agents resolve to
id 0 ("Other"). A proper UA parsing library would improve coverage.

**Outbox has no processor.** The `outbox` table accumulates rows written at link creation
but nothing reads or processes them. The infrastructure is ready for an event-driven
consumer (notifications, webhooks, analytics pipeline feed), but none is implemented.

**Single Redis client per service instance.** The API connects to `redis-primary` only;
the replica declared in compose is available but not used by the application code today.
A read/write split (writes to primary, reads from replica) would be the next step.

**In-memory rate limiting does not synchronise across pods.** `ThrottlerModule` uses
per-process counters; horizontal scaling would require a Redis-backed throttle store to
enforce limits accurately across replicas.

**SSRF check covers only literal IP addresses.** The `@IsPublicHttpUrl` validator blocks
URLs whose host is a literal private, loopback, or link-local IP. Hostnames that resolve
to private IPs at request time are not checked; a DNS-rebinding or split-horizon DNS
attack could bypass the static check.

**Swagger UI is disabled in production.** `NODE_ENV=production` gates `mountSwagger`;
the API schema is accessible only when running the stack locally with a non-production
`NODE_ENV`.
