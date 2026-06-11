# api

## Purpose

Typed HTTP client for the web app. All API calls go through a single `apiFetch`
helper that sends HttpOnly session cookies automatically and maps non-2xx
responses to an `ApiError` with the RFC 9457 problem-details message extracted.

## Key pieces

- `client.ts` -- `apiFetch<P, M>(path, method, opts?)`. Fully typed against the
  generated OpenAPI path map: TypeScript infers the request body shape and the
  success response shape from the path + method pair at compile time. Sets
  `credentials: 'include'` on every request so the browser attaches the HttpOnly
  session cookies without script-visible token storage. Throws `ApiError` on
  non-2xx responses.
- `openapi-generated.ts` -- generated from `apps/api/spec/main.tsp` via
  `pnpm spec:all`; do not hand-edit.
- `types.ts` -- re-exports the subset of OpenAPI types that the app consumes
  (e.g. `MeResponse`, `CreateLinkRequest`).

## How to extend safely

- Always call the API through `apiFetch`; do not use raw `fetch` with manual
  auth headers. The `credentials: 'include'` flag is what sends the HttpOnly
  cookie; bypassing `apiFetch` would require re-implementing that logic.
- New API paths must originate in `apps/api/spec/main.tsp`. After regenerating
  with `pnpm spec:all` the new path becomes available to `apiFetch`'s type
  parameters automatically.
- `ApiError` carries a `status` number and an optional `problemType` string
  (the RFC 9457 `type` URI). Use `problemType` to distinguish specific error
  conditions rather than parsing the `message` string.
- Do not add script-readable token storage (localStorage, sessionStorage) for
  authentication -- the HttpOnly cookie model used here is intentional.
