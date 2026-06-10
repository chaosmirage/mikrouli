# 0006 - Contract-First API via TypeSpec / OpenAPI with RFC 9457 Error Shape

**Status:** Accepted

## Context

The REST API is consumed by a React SPA and by programmatic clients using API
keys. Without a formal contract, the client and server can drift: a server
change that removes or renames a field breaks clients silently at runtime
rather than at build or review time.

Two broad approaches exist:

1. **Code-first:** implement the handlers and generate an OpenAPI document from
   decorator-annotated source code. The contract is derived from the
   implementation.
2. **Contract-first (spec-first):** write the contract independently of the
   implementation and generate or validate the implementation against it.
   The contract is the single source of truth.

With a code-first approach, the contract is accurate only if every handler and
DTO is annotated correctly; gaps are silent. With a contract-first approach,
a client developer can read the spec without reading implementation code, and client
generation can happen before the server is built.

For error responses, ad-hoc error shapes (different structure per endpoint)
make client error handling harder and are not machine-readable by standard
tooling. RFC 9457 (Problem Details for HTTP APIs) defines a standard,
`application/problem+json` error envelope.

Evidence:
- `apps/api/spec/main.tsp` is the TypeSpec source. It defines all request/
  response models and operations.
- `apps/api/spec/tspconfig.yaml` configures the `@typespec/openapi3` emitter;
  the generated output lives in `apps/api/spec/tsp-output/`.
- `apps/api/spec/main.tsp` declares a `ProblemDetails` model with
  `@header("content-type") contentType: "application/problem+json"` and
  spreads it into every `@error` response model.

## Decision

Adopt a contract-first approach: all API types and operations are defined in
`apps/api/spec/main.tsp` using TypeSpec, which compiles to an OpenAPI 3 document.
The TypeSpec source is the single source of truth for the API contract; the
generated OpenAPI document is checked into the repository.

All error responses use the RFC 9457 Problem Details shape
(`application/problem+json` content type with `type`, `title`, `status`,
`detail`, and optional `instance` fields).

## Alternatives Considered

- **Code-first with NestJS/Swagger decorators:** lower initial investment
  (no separate spec file), but the contract accuracy depends on keeping
  decorators in sync with implementation. Reviewing the contract means reading
  through controller and DTO source files.
- **Plain OpenAPI YAML authored by hand:** contract-first without a type-safe
  authoring layer. TypeSpec adds a typed model layer that catches structural
  errors at compile time and reduces repetition through model inheritance.
- **GraphQL:** a different contract style with different client tooling
  assumptions; not suited to simple URL-shortener semantics where HTTP
  semantics (redirects, 410 Gone) are load-bearing.
- **Ad-hoc error shapes per endpoint:** no coordination cost, but client code
  must handle multiple error formats and cannot use standard
  `application/problem+json` middleware.

## Consequences

- The TypeSpec compilation step must run before the OpenAPI document is
  up to date; changes to the contract require editing `main.tsp` first.
- Clients and server share a verifiable contract; client code generation
  from the OpenAPI document is straightforward.
- RFC 9457 errors are parseable by any HTTP client that understands
  `application/problem+json`, and error fields (`type`, `title`, `status`,
  `detail`) are standardized across all endpoints.
- The generated OpenAPI document in `tsp-output/` is a build artifact;
  it should be regenerated after any `main.tsp` change.
