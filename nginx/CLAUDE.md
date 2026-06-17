# nginx

## Purpose

Reverse proxy that terminates HTTP, enforces security headers, caps oversized
User-Agent strings, denies dotfile access, and routes requests to either the
NestJS API or the React SPA.

## Key pieces

- `nginx.conf` -- production config. Key behaviors:
  - `server_tokens off` suppresses the nginx version from headers and error pages.
  - User-Agent requests longer than 1024 characters return 400 before proxying.
  - Dotfile requests (`location ~ /\.`) return 404 unconditionally.
  - Security headers (`X-Content-Type-Options`, `X-Frame-Options`,
    `Referrer-Policy`, `Content-Security-Policy`) are applied with `always` so
    they appear on error responses. They are repeated inside every `location`
    block that defines its own `add_header` because nginx clears parent
    `add_header` directives when a child block adds its own.
  - `location ~ "^/([A-Za-z0-9_]{6})$"` -- rewrites short-code slugs to
    `/api/:slug` so NestJS handles them under the uniform `/api` prefix.
  - `X-Real-IP` and `X-Forwarded-For` are forwarded to the API so `req.ip` is
    accurate under the configured trust-proxy hop count.
- `nginx-dev.conf` -- development variant used by the `dev` compose profile;
  proxies Vite HMR and hot-reload websockets. Also carries the runtime flag
  channel for the SPA: `load_module modules/ngx_http_js_module.so;` and
  `env GUEST_SHORTEN_ENABLED;` (both main-context-only, so they appear
  before `events {}`), an `http`-context `js_import` of
  `/etc/nginx/runtime-config.njs` (bind-mounted by docker-compose), and a
  `location = /config.js` block that calls `js_content runtimeConfig.emit`
  to emit `window.__MIKROULI_CONFIG__ = { guestShortenEnabled: <bool> };`
  with `Content-Type: application/javascript` and `Cache-Control: no-cache`.
  The SPA reads this on mount to decide whether to render the landing-page
  shorten form; the hook treats any fetch error as disabled (fail-safe).
- `Dockerfile.nginx-dev` -- builds the dev nginx image with the njs module
  available under `modules/`.

## How to extend safely

- Whenever a `location` block that needs security headers also defines its own
  `add_header`, copy all four security header lines into that block -- nginx does
  not inherit parent `add_header` entries once a child adds one.
- HSTS is not set here because it belongs in the k8s production overlay
  (`k8s/overlays/production/hsts-middleware.yaml`). Do not add `Strict-Transport-
Security` to `nginx.conf`.
- The CSP allows `style-src 'unsafe-inline'` for MUI/Emotion runtime CSS-in-JS.
  Tightening it requires verifying that no MUI component injects inline styles.
- The slug regex (`[A-Za-z0-9_]{6}`) must stay in sync with the slug-generation
  logic in the API and the nginx k8s configmap in
  `k8s/base/web/configmap-nginx.yaml`.
- The runtime flag channel is nginx-side on purpose: it lets the operator
  flip `GUEST_SHORTEN_ENABLED` without rebuilding the SPA. If you add a new
  runtime-exposed flag, extend `runtime-config.njs` (which reads the env var
  in the worker) and the matching `apps/web/scripts/runtime-config.njs`
  source; both sides must agree on the `window.__MIKROULI_CONFIG__` shape
  that `apps/web/src/hooks/useGuestShortenEnabled.ts` consumes. The
  `load_module` and `env` directives are main-context-only and must stay
  above `events {}`.
