/**
 * Verifies that the committed OpenAPI spec truthfully declares the x-api-key
 * security scheme on the correct operation sets:
 *   - Links.* and Stats.* must carry the apiKey scheme
 *   - ApiKeys.* must NOT carry it (key management is human-session-gated)
 *
 * Reads the committed artifact directly — no running stack required.
 */

import * as fs from 'fs';
import * as path from 'path';

export const API_KEY_HEADER = 'x-api-key';

// Path to the committed generated OpenAPI artifact (never hand-edited).
// src/api-keys/ -> src/ -> apps/api/ -> spec/...
const OPENAPI_PATH = path.resolve(
  __dirname,
  '../../spec/tsp-output/@typespec/openapi3/openapi.json',
);

interface SecurityScheme {
  type: string;
  in?: string;
  name?: string;
}

interface OpenApiSpec {
  components?: {
    securitySchemes?: Record<string, SecurityScheme>;
  };
  paths?: Record<string, Record<string, { security?: Array<Record<string, unknown[]>> }>>;
}

function loadOpenApi(): OpenApiSpec {
  const raw = fs.readFileSync(OPENAPI_PATH, 'utf8');
  return JSON.parse(raw) as OpenApiSpec;
}

/**
 * Finds the name of the security scheme that is type=apiKey, in=header, name=x-api-key.
 */
function findApiKeyHeaderSchemeName(spec: OpenApiSpec): string | undefined {
  const schemes = spec.components?.securitySchemes ?? {};
  return Object.entries(schemes).find(
    ([, s]) => s.type === 'apiKey' && s.in === 'header' && s.name === API_KEY_HEADER,
  )?.[0];
}

/**
 * Collects all security scheme names referenced on a path+method operation.
 */
function operationSchemeNames(
  spec: OpenApiSpec,
  urlPath: string,
  method: string,
): string[] {
  const op = spec.paths?.[urlPath]?.[method];
  if (!op?.security) return [];
  return op.security.flatMap(Object.keys);
}

describe('OpenAPI contract: x-api-key security scheme', () => {
  let spec: OpenApiSpec;
  let apiKeySchemeId: string;

  beforeAll(() => {
    spec = loadOpenApi();
    const found = findApiKeyHeaderSchemeName(spec);
    // If undefined, the first assertion below will fail with a clear message
    apiKeySchemeId = found ?? '__MISSING__';
  });

  it('declares an apiKey securityScheme with in=header and name=x-api-key', () => {
    const schemes = spec.components?.securitySchemes ?? {};
    const scheme = Object.values(schemes).find(
      (s) => s.type === 'apiKey' && s.in === 'header' && s.name === API_KEY_HEADER,
    );
    expect(scheme).toBeDefined();
    expect(scheme?.type).toBe('apiKey');
    expect(scheme?.in).toBe('header');
    expect(scheme?.name).toBe(API_KEY_HEADER);
  });

  describe('Links operations carry the x-api-key scheme', () => {
    it('POST /api/urls includes x-api-key scheme', () => {
      const names = operationSchemeNames(spec, '/api/urls', 'post');
      expect(names).toContain(apiKeySchemeId);
    });

    it('GET /api/urls includes x-api-key scheme', () => {
      const names = operationSchemeNames(spec, '/api/urls', 'get');
      expect(names).toContain(apiKeySchemeId);
    });

    it('DELETE /api/urls/{slug} includes x-api-key scheme', () => {
      const urlPath = Object.keys(spec.paths ?? {}).find(
        (p) => p.startsWith('/api/urls/') && p.includes('{'),
      ) ?? '/api/urls/{slug}';
      const names = operationSchemeNames(spec, urlPath, 'delete');
      expect(names).toContain(apiKeySchemeId);
    });
  });

  describe('Stats operations carry the x-api-key scheme', () => {
    it('GET /api/stats/{slug} includes x-api-key scheme', () => {
      const urlPath = Object.keys(spec.paths ?? {}).find(
        (p) => p.startsWith('/api/stats/') && p.includes('{'),
      ) ?? '/api/stats/{slug}';
      const names = operationSchemeNames(spec, urlPath, 'get');
      expect(names).toContain(apiKeySchemeId);
    });
  });

  describe('ApiKeys operations do NOT carry the x-api-key scheme', () => {
    it('POST /api/api-keys does not include x-api-key scheme', () => {
      const names = operationSchemeNames(spec, '/api/api-keys', 'post');
      expect(names).not.toContain(apiKeySchemeId);
    });

    it('GET /api/api-keys does not include x-api-key scheme', () => {
      const names = operationSchemeNames(spec, '/api/api-keys', 'get');
      expect(names).not.toContain(apiKeySchemeId);
    });
  });
});
