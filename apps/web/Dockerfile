# apps/web/Dockerfile
#
# Multi-target build for the React/Vite frontend.
#
# Targets:
#   builder    — install deps + build the SPA bundle (intermediate)
#   dev        — vite dev server on :5173 with HMR (used by docker-compose)
#   production — nginx-unprivileged serving the built static assets on :8080
#                (used by k8s, default target when no --target is given)

# =============================================================================
# Stage 1: builder (also used as base for dev)
# =============================================================================
FROM node:24-alpine AS builder

RUN corepack enable

WORKDIR /app

# Copy workspace manifests for pnpm resolution
COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./
COPY apps/web/package.json ./apps/web/

RUN pnpm install --filter web... --frozen-lockfile

# Copy web source
COPY apps/web/ ./apps/web/

# Build static SPA → apps/web/dist
RUN pnpm --filter web build

# =============================================================================
# Stage 2a: dev (vite dev server with HMR)
# Used by docker-compose; bind-mounts overlay live source.
# =============================================================================
FROM node:24-alpine AS dev

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./
COPY apps/web/package.json ./apps/web/

RUN pnpm install --filter web... --frozen-lockfile

COPY apps/web/ ./apps/web/

# Vite needs write access to the whole workspace root for its temp files
RUN chown -R node:node /app

USER node
EXPOSE 5173

CMD ["pnpm", "--filter", "web", "dev", "--", "--host", "0.0.0.0"]

# =============================================================================
# Stage 2b: production (nginx serving static assets) — DEFAULT
# =============================================================================
FROM nginxinc/nginx-unprivileged:1.27-alpine AS production

USER root

# The njs module ships with the base image at
# /usr/lib/nginx/modules/ngx_http_js_module.so — no apk install needed.

# njs main-context directives: load_module + env must live in /etc/nginx/nginx.conf
# (the main context), NOT in conf.d (which is included under http {}). Sed injects
# them before the `events {` block so nginx sees them at top level.
RUN sed -i '/^events {/i \
load_module modules/ngx_http_js_module.so;\n\
env GUEST_SHORTEN_ENABLED;' /etc/nginx/nginx.conf

# njs http-context directive + the /config.js handler. conf.d/*.conf is included
# under http {}, so a dedicated 00-njs.conf carries js_import at the right scope.
COPY apps/web/scripts/runtime-config.njs /etc/nginx/runtime-config.njs
RUN printf 'js_import runtimeConfig from /etc/nginx/runtime-config.njs;\n' \
    > /etc/nginx/conf.d/00-njs.conf

USER nginx

# Replace stock welcome page with our built SPA
COPY --from=builder /app/apps/web/dist/ /usr/share/nginx/html/

# SPA history-fallback server config (serves index.html for client-side routes)
COPY apps/web/nginx-spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
