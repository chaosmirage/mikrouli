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
  proxies Vite HMR and hot-reload websockets.

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
