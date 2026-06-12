/**
 * Static drift guard: asserts that apps/web/public/llms.txt and the committed
 * OpenAPI JSON share the same auth-header and path literals, AND that the
 * response shape documented in llms.txt matches the real PublicLink schema.
 *
 * Fails CI immediately if the guide diverges from the contract -- no running
 * stack required.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const WEB_PUBLIC = path.resolve(__dirname, '../public');
const OPENAPI_PATH = path.resolve(
  __dirname,
  '../../api/spec/tsp-output/@typespec/openapi3/openapi.json',
);

function readLlmsTxt(): string {
  return fs.readFileSync(path.join(WEB_PUBLIC, 'llms.txt'), 'utf8');
}

function readOpenApi(): string {
  return fs.readFileSync(OPENAPI_PATH, 'utf8');
}

interface OpenApiSchema {
  type: string;
  required?: string[];
  properties?: Record<string, unknown>;
}

interface OpenApiSpec {
  components?: {
    schemas?: Record<string, OpenApiSchema>;
  };
}

describe('llms.txt drift guard vs OpenAPI contract', () => {
  it('llms.txt exists and is non-empty', () => {
    const txt = readLlmsTxt();
    expect(txt.length).toBeGreaterThan(0);
  });

  it('llms.txt contains the x-api-key auth header literal', () => {
    const txt = readLlmsTxt();
    expect(txt).toContain('x-api-key');
  });

  it('llms.txt contains the /api/urls path literal', () => {
    const txt = readLlmsTxt();
    expect(txt).toContain('/api/urls');
  });

  it('llms.txt contains the mk_ key prefix', () => {
    const txt = readLlmsTxt();
    expect(txt).toContain('mk_');
  });

  it('llms.txt contains /api/mcp endpoint reference', () => {
    const txt = readLlmsTxt();
    expect(txt).toContain('/api/mcp');
  });

  it('openapi.json declares x-api-key in header scheme', () => {
    const raw = readOpenApi();
    const spec = JSON.parse(raw) as Record<string, unknown>;
    const text = JSON.stringify(spec);
    // The scheme must declare the header name
    expect(text).toContain('"x-api-key"');
    expect(text).toContain('"in":"header"');
  });

  it('openapi.json has the /api/urls path', () => {
    const raw = readOpenApi();
    expect(raw).toContain('/api/urls');
  });

  it('llms.txt does not contain Authorization: Bearer mk_ (must not lie about bearer path)', () => {
    const txt = readLlmsTxt();
    expect(txt).not.toMatch(/Authorization:\s*Bearer\s+mk_/);
  });

  // ---------------------------------------------------------------------------
  // PublicLink shape truthfulness assertions
  // These would have caught the original defect: llms.txt claiming "slug" field
  // and shortUrl = full URL, while the real schema has shortUrl = 6-char slug.
  // ---------------------------------------------------------------------------

  it('llms.txt documents "shortUrl" as the PublicLink response field (not "slug")', () => {
    const txt = readLlmsTxt();
    // The documented response example must use "shortUrl" as the field name
    expect(txt).toContain('"shortUrl"');
  });

  it('llms.txt does NOT document a "slug" JSON field in the REST response body', () => {
    const txt = readLlmsTxt();
    // There must be no "slug": ... JSON-like entry in the response description.
    // A bare "slug" in text is OK (it describes the concept), but not as a JSON key.
    expect(txt).not.toMatch(/"slug"\s*:/);
  });

  it('llms.txt documents "originalUrl" as a PublicLink field', () => {
    const txt = readLlmsTxt();
    expect(txt).toContain('"originalUrl"');
  });

  it('llms.txt documents "createdAt" as a PublicLink field', () => {
    const txt = readLlmsTxt();
    expect(txt).toContain('"createdAt"');
  });

  it('llms.txt documents "expiresAt" as a PublicLink field', () => {
    const txt = readLlmsTxt();
    expect(txt).toContain('"expiresAt"');
  });

  it('llms.txt clarifies that shortUrl is a slug, not a full URL', () => {
    const txt = readLlmsTxt();
    // The file must explain that shortUrl is a slug / 6-char value
    expect(txt.toLowerCase()).toMatch(/shorturl.*slug|slug.*shorturl/s);
  });

  it('openapi.json PublicLink schema has shortUrl, originalUrl, createdAt, expiresAt fields', () => {
    const raw = readOpenApi();
    const spec = JSON.parse(raw) as OpenApiSpec;
    const publicLink = spec.components?.schemas?.['PublicLink'];
    expect(publicLink).toBeDefined();
    const required = publicLink?.required ?? [];
    const properties = Object.keys(publicLink?.properties ?? {});
    // All four fields must be declared
    for (const field of ['shortUrl', 'originalUrl', 'createdAt', 'expiresAt']) {
      expect(properties).toContain(field);
    }
    // shortUrl must be required
    expect(required).toContain('shortUrl');
    // No "slug" field in the schema
    expect(properties).not.toContain('slug');
  });

  it('openapi.json PublicLink schema does NOT have a "slug" field', () => {
    const raw = readOpenApi();
    const spec = JSON.parse(raw) as OpenApiSpec;
    const publicLink = spec.components?.schemas?.['PublicLink'];
    const properties = Object.keys(publicLink?.properties ?? {});
    expect(properties).not.toContain('slug');
  });

  it('llms.txt documented field set matches openapi.json PublicLink properties', () => {
    const txt = readLlmsTxt();
    const raw = readOpenApi();
    const spec = JSON.parse(raw) as OpenApiSpec;
    const publicLink = spec.components?.schemas?.['PublicLink'];
    const schemaFields = Object.keys(publicLink?.properties ?? {});

    // Every field in the PublicLink schema must be mentioned in llms.txt
    for (const field of schemaFields) {
      expect(txt).toContain(field);
    }
  });
});
