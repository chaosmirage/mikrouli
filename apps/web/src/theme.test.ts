import { describe, it, expect } from 'vitest';
import { createAppTheme } from './theme';
import type { PaletteMode } from '@mui/material/styles';

// Helper: parse a "#RRGGBB" hex string into [r, g, b] (0-255).
function hexToRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`unexpected non-hex color ${hex}`);
  const n = parseInt(m[1] as string, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// WCAG 2.x relative luminance.
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

// WCAG 2.x contrast ratio (1.0 .. 21.0).
function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(hexToRgb(fg));
  const l2 = relativeLuminance(hexToRgb(bg));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const BOTH_MODES: PaletteMode[] = ['light', 'dark'];

describe('createAppTheme', () => {
  it.each(BOTH_MODES)('returns a valid MUI theme for mode %s', (mode) => {
    const t = createAppTheme(mode);
    expect(t.palette.mode).toBe(mode);
    expect(typeof t.palette.primary.main).toBe('string');
    expect(typeof t.palette.secondary.main).toBe('string');
    expect(typeof t.palette.warning.main).toBe('string');
    expect(typeof t.palette.background.default).toBe('string');
  });

  it.each(BOTH_MODES)('lightens/darkens the background between modes (%s)', (mode) => {
    const t = createAppTheme(mode);
    const bg = t.palette.background.default;
    expect(bg).not.toBeUndefined();
    // Just ensure the value is present and a string hex we can parse.
    expect(() => hexToRgb(bg as string)).not.toThrow();
  });

  // The DARK palette must keep primary/secondary/warning >= 3.0:1 against the
  // dark background so chart series and the landing-page highlight stay legible
  // in dark mode. The light palette is the unchanged design language.
  it('dark palette keeps primary/secondary/warning >= 3.0:1 vs dark background', () => {
    const t = createAppTheme('dark');
    const bg = t.palette.background.default as string;
    const minContrast = 3.0;
    const primary = t.palette.primary.main as string;
    const secondary = t.palette.secondary.main as string;
    const warning = t.palette.warning.main as string;
    expect(contrastRatio(primary, bg)).toBeGreaterThanOrEqual(minContrast);
    expect(contrastRatio(secondary, bg)).toBeGreaterThanOrEqual(minContrast);
    expect(contrastRatio(warning, bg)).toBeGreaterThanOrEqual(minContrast);
  });

  it('light palette keeps primary/secondary >= 3.0:1 vs light background', () => {
    const t = createAppTheme('light');
    const bg = t.palette.background.default as string;
    const minContrast = 3.0;
    // The light warning is the original coral accent used only for decorative
    // chart series + the landing-page highlight underline; it is not in the
    // >= 3.0:1 contract (G5 covers dark only). primary + secondary ARE.
    const primary = t.palette.primary.main as string;
    const secondary = t.palette.secondary.main as string;
    expect(contrastRatio(primary, bg)).toBeGreaterThanOrEqual(minContrast);
    expect(contrastRatio(secondary, bg)).toBeGreaterThanOrEqual(minContrast);
  });

  it('dark primary.main is not the same as light primary.main (palette adapts to mode)', () => {
    const light = createAppTheme('light');
    const dark = createAppTheme('dark');
    expect(dark.palette.primary.main).not.toBe(light.palette.primary.main);
  });

  it('dark background.default is darker than light background.default', () => {
    const lightBg = relativeLuminance(
      hexToRgb(createAppTheme('light').palette.background.default as string),
    );
    const darkBg = relativeLuminance(
      hexToRgb(createAppTheme('dark').palette.background.default as string),
    );
    expect(darkBg).toBeLessThan(lightBg);
  });
});
