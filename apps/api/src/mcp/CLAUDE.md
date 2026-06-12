# mcp

## Purpose

Exposes a hosted Model Context Protocol (MCP) Streamable HTTP endpoint at
`POST /api/mcp`. Authenticated machine clients (LLM agents and automated
scripts) connect here to shorten URLs via the `create_short_link` tool
without going through the browser-session auth path.

## Key pieces

- `mcp.controller.ts` -- `McpController`. Mounts at `@Controller('mcp')`.
  Every `POST /api/mcp` request is guarded by `ApiKeyAuthGuard` (`x-api-key`
  header only; cookie auth is excluded to avoid CSRF exposure on a
  JSON-RPC POST endpoint). A fresh `McpServer` +
  `StreamableHTTPServerTransport` is created per request so no credential
  or server state is retained across calls. `GET` and `DELETE` return 405.
- `create-short-link.handler.ts` -- `createShortLinkHandler`. Returns a
  stateless per-request tool handler bound to the authenticated caller's
  `userId` and the configured public base URL. Validates the input against
  `CreateLinkDto` (same rules and SSRF guard as the REST controller),
  calls `LinksService.create` in-process, and shapes the result to match
  the `PublicLink` contract. The text content is the full usable link
  (`baseUrl + "/" + shortUrl`); `structuredContent` carries the full
  `PublicLink` fields plus `shortLink`.
- `mcp-error-mapper.ts` -- `mapHttpExceptionToToolError`. Projects
  `HttpException` instances into MCP `CallToolResult` with `isError: true`,
  deriving the error text from `buildProblemFromStatus` (the same helper
  the REST `ProblemDetailsFilter` uses). Field-level 422 errors include a
  "; field errors: ..." suffix. Stack traces are never included.
- `mcp.module.ts` -- `McpModule`. Wires `ApiKeyAuthGuard`, `ApiKeysService`,
  `LinksService`, and the `PUBLIC_BASE_URL_TOKEN` provider (reads
  `PUBLIC_BASE_URL` env var, defaults to `https://mikrou.li`).

## How to extend safely

- Auth is `ApiKeyAuthGuard` only. Do not add `JwtAuthGuard` or cookie-based
  auth to this controller: a cookie-authenticated JSON-RPC POST is a CSRF
  risk that the single-transport design deliberately avoids.
- Every new tool handler must re-validate its input via `plainToInstance` +
  `class-validator` before calling any service. Calling a service directly
  bypasses the global `ValidationPipe` which runs only on NestJS route
  parameters, not on in-process handler arguments.
- Route error results through `mapHttpExceptionToToolError` for
  `HttpException` instances. Never return raw exception details or stack
  traces in tool content.
- Any new tool that creates or mutates data must be added to `main.tsp`
  first (edit the TypeSpec, then run `pnpm spec:all`). The tool description
  and input schema must match the REST contract so both surfaces stay in
  parity.
- `PUBLIC_BASE_URL` must not have a trailing slash; `mcp.module.ts` strips
  it, and `create-short-link.handler.ts` strips it again defensively. New
  code that constructs full URLs should follow the same pattern.
