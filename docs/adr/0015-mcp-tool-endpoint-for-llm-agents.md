# 0015 - MCP Tool Endpoint for LLM Agents

## Status

Accepted

## Context

The shortener already exposes a REST surface that programmatic clients drive with
an API key (`POST /api/urls`). LLM agents increasingly consume tools through the
Model Context Protocol (MCP) rather than bespoke REST integrations. Without a
native MCP surface, an agent author would have to wrap the REST endpoint by hand
and reproduce the request/response contract, the SSRF input rules, and the error
shape.

The goal was to let an agent create a short link through MCP while reusing the
exact validation and error authority the REST path already enforces, without
introducing a new auth mechanism, new persistence path, or stateful session
storage.

## Decision

Expose a Streamable-HTTP MCP server at `POST /api/mcp`
(`apps/api/src/mcp/mcp.controller.ts`) that registers a single tool,
`create_short_link`. The tool accepts a target `url` and an optional ISO 8601
`expiresAt`, and returns the full usable short link as text plus `PublicLink`
metadata in `structuredContent`.

- **Authentication is API-key only.** The endpoint is guarded by
  `ApiKeyAuthGuard` (the `x-api-key` header). Cookie/JWT auth is deliberately
  excluded because a cookie-authenticated JSON-RPC POST is a CSRF-shaped risk.
- **Stateless per request.** A fresh `McpServer` and
  `StreamableHTTPServerTransport` (`sessionIdGenerator: undefined`,
  `enableJsonResponse: true`) are constructed for every POST and torn down when
  the response closes, so no credential or session state is retained across
  requests. This keeps the endpoint horizontally scalable like the rest of the
  API.
- **Shared validation and creation path.** The tool handler
  (`apps/api/src/mcp/create-short-link.handler.ts`) re-validates input through the
  same `CreateLinkDto` (including the `@IsPublicHttpUrl` SSRF guard) that the REST
  controller uses, then calls `LinksService.create` in process. Because calling
  the service directly bypasses the global `ValidationPipe`, the handler runs
  `plainToInstance` + `class-validator` itself to keep the rules identical.
- **Shared error authority.** `mapHttpExceptionToToolError`
  (`apps/api/src/mcp/mcp-error-mapper.ts`) projects thrown `HttpException`s into
  MCP `isError` results using the same `buildProblemFromStatus` helper that the
  REST RFC 9457 filter relies on. Stack traces are excluded so no internal detail
  leaks.
- **POST only.** `GET` and `DELETE` on the route return 405.

## Alternatives considered

- **Wrap the REST endpoint outside the service.** An external adapter would have
  to duplicate the contract and error mapping and could drift from the REST path
  over time. Calling `LinksService` in process with shared DTO validation keeps a
  single source of truth.
- **Reuse cookie/JWT auth for the MCP route.** Rejected: a cookie-authenticated
  JSON-RPC POST endpoint is exposed to CSRF. API-key auth carries the credential
  in an explicit header and matches how other programmatic clients already
  authenticate.
- **Stateful MCP sessions.** The transport supports session ids, but retaining
  per-session state would tie a connection to a single instance and complicate
  horizontal scaling. A fresh, stateless server per request avoids that.

## Consequences

- Agents can create short links over MCP with no bespoke REST wrapper; the tool
  description and input schema are self-documenting.
- The MCP and REST paths cannot diverge in validation or error reporting because
  both flow through `CreateLinkDto` and `buildProblemFromStatus`.
- Only `create_short_link` is exposed today; listing, deleting, or reading stats
  over MCP would require registering additional tools.
- The endpoint inherits the REST path's SSRF limitation: `@IsPublicHttpUrl`
  blocks literal private/loopback IPs but not hostnames that resolve to private
  addresses at request time.
