/**
 * First-paint drift guard: asserts that the anti-flash script's inline
 * background literals in index.html equal the theme factory's surface.canvas
 * token for both color modes, so the pre-React paint never diverges from the
 * resolved theme. The persisted-choice contract (storage key + closed enum)
 * is pinned on both sides at once.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createAppTheme } from './theme';

const INDEX_HTML_PATH = path.resolve(__dirname, '../index.html');

function readIndexHtml(): string {
  return fs.readFileSync(INDEX_HTML_PATH, 'utf8');
}

/** Extract the script's two background literals: `... 'dark' ? '<dark>' : '<light>'`. */
function readScriptLiterals(html: string): { dark: string; light: string } {
  const m = /'dark'\s*\?\s*'([^']+)'\s*:\s*'([^']+)'/.exec(html);
  if (!m) throw new Error('anti-flash background literals not found in index.html');
  return { dark: m[1] as string, light: m[2] as string };
}

/** Extract the CSS fallback literal: `var(--mikrouli-initial-bg, '<fallback>')`. */
function readStyleFallback(html: string): string {
  const m = /--mikrouli-initial-bg,\s*([^)]+)\)/.exec(html);
  if (!m) throw new Error('CSS fallback literal not found in index.html');
  return (m[1] as string).trim();
}

describe('first-paint background matches the theme canvas token', () => {
  it('script dark literal equals the dark-mode surface.canvas', () => {
    const { dark } = readScriptLiterals(readIndexHtml());
    expect(dark.toLowerCase()).toBe(createAppTheme('dark').palette.surface.canvas.toLowerCase());
  });

  it('script light literal equals the light-mode surface.canvas', () => {
    const { light } = readScriptLiterals(readIndexHtml());
    expect(light.toLowerCase()).toBe(createAppTheme('light').palette.surface.canvas.toLowerCase());
  });

  it('CSS fallback literal equals the light-mode surface.canvas', () => {
    const fallback = readStyleFallback(readIndexHtml());
    expect(fallback.toLowerCase()).toBe(
      createAppTheme('light').palette.surface.canvas.toLowerCase(),
    );
  });
});

describe('persisted-choice contract stays two-sided', () => {
  it('index.html and the theme mode provider share the storage key', () => {
    const html = readIndexHtml();
    expect(html).toContain("var STORAGE_KEY = 'mikrouli.themeMode'");
  });

  it('index.html validates against the same three-literal closed enum', () => {
    const html = readIndexHtml();
    expect(html).toContain("raw === 'light' || raw === 'dark' || raw === 'follow-system'");
  });
});
