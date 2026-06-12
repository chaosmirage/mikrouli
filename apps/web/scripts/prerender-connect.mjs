/**
 * Postbuild prerender step for /connect.
 *
 * Reads the Vite-built dist/index.html, injects page-specific title,
 * description, and canonical meta for /connect, then writes the result
 * to dist/connect/index.html.
 *
 * The #root div is pre-populated with the static ConnectPage content so
 * that crawlers and LLM agents reading raw HTML (no JS) see the REST/MCP
 * integration instructions. The SPA hydrates over this markup on load.
 *
 * No new runtime dependencies -- uses only Node built-ins and locale JSON
 * files that are part of the source tree.
 */

import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, '../dist');
const CONNECT_DIR = resolve(DIST, 'connect');
const SRC = resolve(__dirname, '../src');

// Load English connect namespace for the static render.
const t = JSON.parse(
  readFileSync(resolve(SRC, 'i18n/locales/en/connect.json'), 'utf8'),
);

const PAGE_TITLE = 'Connect an agent -- mikrouli';
const PAGE_DESCRIPTION =
  'Integrate mikrouli into your scripts and AI agents via the REST API or the hosted MCP server. Authenticate with an mk_ API key.';
const CANONICAL = 'https://mikrou.li/connect';

const REST_CURL_EXAMPLE = `curl -s -X POST https://mikrou.li/api/urls \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: mk_&lt;your-key&gt;" \\
  -d '{"url":"https://example.com/long-url"}' | jq .`;

const MCP_CURL_EXAMPLE = `curl -s -X POST https://mikrou.li/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: mk_&lt;your-key&gt;" \\
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "id": 1,
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": { "name": "my-agent", "version": "1" }
    }
  }'`;

// Exact verified command for wiring mikrouli into Claude Code as an MCP server.
const CLAUDE_MCP_ADD_COMMAND = `claude mcp add --scope user --transport http mikrouli \\
  https://mikrou.li/api/mcp \\
  --header "x-api-key: mk_&lt;your-key&gt;"`;

// Minimal static HTML representing ConnectPage rendered in English.
// The SPA will replace this on hydration; crawlers see it without JS.
const PRERENDERED_BODY = `<main data-testid="connect-page">
  <div>
    <h1>${t.pageTitle}</h1>
    <p>${t.pageDescription}</p>
    <a href="/llms.txt">${t.llmsFileLink}</a>
  </div>
  <section data-testid="connect-apikey-section">
    <h2>${t.apiKeySectionTitle}</h2>
    <p>${t.apiKeySectionDesc}</p>
    <ol>
      <li>${t.apiKeySignIn}</li>
      <li>${t.apiKeyNavigate}</li>
      <li>${t.apiKeyCreate}</li>
    </ol>
    <p>${t.apiKeyNote}</p>
  </section>
  <section data-testid="connect-rest-section">
    <h2>${t.restSectionTitle}</h2>
    <h3>${t.restAuthHeader}</h3>
    <p>${t.restAuthHeaderDesc}</p>
    <code>x-api-key: mk_&lt;your-key&gt;</code>
    <h3>${t.restEndpoint}</h3>
    <p>${t.restEndpointDesc}</p>
    <pre><code>${REST_CURL_EXAMPLE}</code></pre>
  </section>
  <section data-testid="connect-mcp-section">
    <h2>${t.mcpSectionTitle}</h2>
    <p>${t.mcpSectionDesc}</p>
    <h3>${t.mcpEndpoint}</h3>
    <code>/api/mcp</code>
    <p>${t.mcpProtocol}</p>
    <p>${t.mcpAuthNote}</p>
    <pre><code>${MCP_CURL_EXAMPLE}</code></pre>
    <h3>${t.mcpClaudeCodeTitle}</h3>
    <p>${t.mcpClaudeCodeDesc}</p>
    <pre><code>${CLAUDE_MCP_ADD_COMMAND}</code></pre>
  </section>
</main>`;

const base = readFileSync(resolve(DIST, 'index.html'), 'utf8');

function replaceFirst(html, pattern, replacement) {
  return html.replace(pattern, replacement);
}

let out = base;

// Replace <title>
out = replaceFirst(
  out,
  /<title>[^<]*<\/title>/,
  `<title>${PAGE_TITLE}</title>`,
);

// Replace primary description
out = replaceFirst(
  out,
  /(<meta\s+name="description"\s+content=")[^"]*(")/,
  `$1${PAGE_DESCRIPTION}$2`,
);

// Replace canonical href
out = replaceFirst(
  out,
  /(<link\s+rel="canonical"\s+href=")[^"]*(")/,
  `$1${CANONICAL}$2`,
);

// Replace og:title
out = replaceFirst(
  out,
  /(<meta\s+property="og:title"\s+content=")[^"]*(")/,
  `$1${PAGE_TITLE}$2`,
);

// Replace og:description
out = replaceFirst(
  out,
  /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
  `$1${PAGE_DESCRIPTION}$2`,
);

// Replace og:url
out = replaceFirst(
  out,
  /(<meta\s+property="og:url"\s+content=")[^"]*(")/,
  `$1${CANONICAL}$2`,
);

// Replace twitter:title
out = replaceFirst(
  out,
  /(<meta\s+name="twitter:title"\s+content=")[^"]*(")/,
  `$1${PAGE_TITLE}$2`,
);

// Replace twitter:description
out = replaceFirst(
  out,
  /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,
  `$1${PAGE_DESCRIPTION}$2`,
);

// Inject the prerendered connect page content into #root.
// The SPA bundles are kept; they will take over on load.
out = replaceFirst(
  out,
  /<div id="root"><\/div>/,
  `<div id="root">${PRERENDERED_BODY}</div>`,
);

mkdirSync(CONNECT_DIR, { recursive: true });
writeFileSync(resolve(CONNECT_DIR, 'index.html'), out, 'utf8');

console.log('prerender-connect: dist/connect/index.html written');
