# public

## Purpose

Static files served verbatim by Vite (development) and nginx (production)
before the SPA fallback. Files here are reachable at their literal path
without React executing -- suitable for machine-readable content and
standard web-discovery conventions.

## Key pieces

- `robots.txt` -- crawl policy. Disallows auth, dashboard, and API paths;
  allows the landing page, `/connect`, and `/llms.txt`. Carries an `LLMs:`
  directive pointing to `/llms.txt` and a `Sitemap:` entry.
- `llms.txt` -- machine-readable integration guide for LLM agents and
  automated scripts. Documents the API base URL, `x-api-key` authentication,
  `POST /api/urls` REST usage with request/response shapes, and the MCP
  Streamable HTTP endpoint at `POST /api/mcp` with the `create_short_link`
  tool. Served at `https://mikrou.li/llms.txt` directly by the `$uri` nginx
  rule, no React needed.
- `sitemap.xml` -- XML sitemap listing the indexable public pages.

## How to extend safely

- A new file placed here is served at its exact path by nginx `$uri` before
  the SPA `try_files` fallback. No nginx or Vite config change is needed for
  plain files at the root.
- When adding a new publicly accessible static file (e.g. a
  `.well-known/` document), add a matching `Disallow:` or explicit comment
  in `robots.txt` so the crawl policy stays accurate.
- `llms.txt` describes the API contract surface visible to automated
  clients. Keep it in sync with any changes to auth headers, endpoint paths,
  request/response shapes, or the MCP tool list. It is not generated -- edit
  it directly alongside the corresponding TypeSpec change and `pnpm spec:all`
  run.
- Do not place files containing secrets, private user data, or environment
  configuration here; everything in `public/` is world-readable.
