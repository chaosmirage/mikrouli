# apps/api/Dockerfile
#
# Multi-stage build for the NestJS API.
#
# Stage 1 (builder)    — install deps + compile TypeScript
# Stage 2 (production) — lean image with only dist/ and prod deps

# =============================================================================
# Stage 1: builder
# =============================================================================
FROM node:24-alpine AS builder

RUN corepack enable

WORKDIR /app

# Copy workspace manifests first for Docker layer caching
COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/

# Install all dependencies (including devDeps for tsc)
RUN pnpm install --filter api...

# Copy API source and build
COPY apps/api/ ./apps/api/
RUN pnpm --filter api build

# =============================================================================
# Stage 2: production
# =============================================================================
FROM node:24-alpine AS production

RUN corepack enable

ENV NODE_ENV=production
WORKDIR /app

# Copy workspace manifests for prod install
COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/

# Install production deps only
RUN pnpm install --filter api... --prod

# Copy compiled output and the TypeSpec-generated OpenAPI spec from builder.
# The Swagger UI mount in main.ts reads the spec at runtime via a relative path
# (../spec/tsp-output/@typespec/openapi3/openapi.json), so the spec/ directory
# must accompany dist/ inside the image.
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/spec/tsp-output ./apps/api/spec/tsp-output

USER node
EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]
