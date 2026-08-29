import { describe, it, expect } from 'vitest';
import type { PaletteMode } from '@mui/material/styles';
import * as themeModule from './theme';
import {
  createAppTheme,
  REDUCED_MOTION_COLLAPSE,
  REDUCED_MOTION_QUERY,
  SPACE,
  TECHNICAL_FAMILY,
} from './theme';

/**
 * The named token system of the theme factory: palette groups, typographic
 * scale, spacing ladder, depth steps, and motion tokens -- stated as
 * relations (contrast floors, scale ratios, ladder steps) for BOTH color
 * modes, plus the one overrides block reading the resolved tokens.
 */

// --- Color math (WCAG 2.x) -------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`unexpected non-hex color ${hex}`);
  const n = parseInt(m[1] as string, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(hexToRgb(fg));
  const l2 = relativeLuminance(hexToRgb(bg));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// --- Font-size math ----------------------------------------------------------

const ROOT_FONT_SIZE = 16;

function toPx(size: string | number | undefined): number {
  if (size === undefined) throw new Error('missing font size');
  const raw = String(size).trim();
  const m = /^([\d.]+)(rem|px)$/.exec(raw);
  if (!m) throw new Error(`unexpected font size ${raw}`);
  const value = parseFloat(m[1] as string);
  return m[2] === 'rem' ? value * ROOT_FONT_SIZE : value;
}

function parseRgba(color: string): { r: number; g: number; b: number; a: number } {
  const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(color);
  if (!m) throw new Error(`unexpected non-translucent color ${color}`);
  return {
    r: parseInt(m[1] as string, 10),
    g: parseInt(m[2] as string, 10),
    b: parseInt(m[3] as string, 10),
    a: parseFloat(m[4] as string),
  };
}

const BOTH_MODES: PaletteMode[] = ['light', 'dark'];

function styleOverridesOf(
  theme: ReturnType<typeof createAppTheme>,
  component: string,
): Record<string, Record<string, unknown>> {
  const overrides = (
    theme.components as Record<string, { styleOverrides?: unknown }> | undefined
  )?.[component]?.styleOverrides;
  if (!overrides) throw new Error(`missing ${component} styleOverrides`);
  return overrides as Record<string, Record<string, unknown>>;
}

describe('theme module surface', () => {
  it('serves callers through the factory only (no pre-built theme instance)', () => {
    // Read through a record lens so the deprecated-export check keeps
    // compiling once the name is gone from the module's type.
    const namedExports = themeModule as unknown as Record<string, unknown>;
    expect(namedExports.theme).toBeUndefined();
  });
});

describe('theme token palette groups', () => {
  it.each(BOTH_MODES)('%s mode exposes ink, surface, accent, and line groups', (mode) => {
    const t = createAppTheme(mode);
    expect(t.palette.ink).toBeDefined();
    expect(t.palette.surface).toBeDefined();
    expect(t.palette.accent).toBeDefined();
    expect(t.palette.line).toBeDefined();
  });

  it.each(BOTH_MODES)('%s mode maps legacy palette keys onto the tokens', (mode) => {
    const t = createAppTheme(mode);
    expect(t.palette.background.default).toBe(t.palette.surface.canvas);
    expect(t.palette.background.paper).toBe(t.palette.surface.raised);
    expect(t.palette.text.primary).toBe(t.palette.ink.primary);
    expect(t.palette.text.secondary).toBe(t.palette.ink.secondary);
    expect(t.palette.text.disabled).toBe(t.palette.ink.muted);
    expect(t.palette.divider).toBe(t.palette.line.hairline);
    expect(t.palette.primary.main).toBe(t.palette.accent.solid);
  });
});

describe('theme token contrast floors (both modes)', () => {
  it.each(BOTH_MODES)('%s mode keeps ink.primary at >= 7:1 on canvas and raised', (mode) => {
    const t = createAppTheme(mode);
    expect(contrastRatio(t.palette.ink.primary, t.palette.surface.canvas)).toBeGreaterThanOrEqual(
      7,
    );
    expect(contrastRatio(t.palette.ink.primary, t.palette.surface.raised)).toBeGreaterThanOrEqual(
      7,
    );
  });

  it.each(BOTH_MODES)('%s mode keeps ink.secondary at >= 4.5:1 on canvas and raised', (mode) => {
    const t = createAppTheme(mode);
    expect(contrastRatio(t.palette.ink.secondary, t.palette.surface.canvas)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrastRatio(t.palette.ink.secondary, t.palette.surface.raised)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it.each(BOTH_MODES)('%s mode keeps ink.muted at >= 3:1 on canvas and raised', (mode) => {
    const t = createAppTheme(mode);
    expect(contrastRatio(t.palette.ink.muted, t.palette.surface.canvas)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(t.palette.ink.muted, t.palette.surface.raised)).toBeGreaterThanOrEqual(3);
  });

  it.each(BOTH_MODES)('%s mode keeps accent.solid at >= 3:1 on canvas and raised', (mode) => {
    const t = createAppTheme(mode);
    expect(contrastRatio(t.palette.accent.solid, t.palette.surface.canvas)).toBeGreaterThanOrEqual(
      3,
    );
    expect(contrastRatio(t.palette.accent.solid, t.palette.surface.raised)).toBeGreaterThanOrEqual(
      3,
    );
  });
});

describe('theme token surface relations', () => {
  it('light mode: canvas is the lightest surface, raised one step darker', () => {
    const t = createAppTheme('light');
    expect(relativeLuminance(hexToRgb(t.palette.surface.canvas))).toBeGreaterThan(
      relativeLuminance(hexToRgb(t.palette.surface.raised)),
    );
  });

  it('dark mode: canvas is the darkest surface, raised one step lighter', () => {
    const t = createAppTheme('dark');
    expect(relativeLuminance(hexToRgb(t.palette.surface.raised))).toBeGreaterThan(
      relativeLuminance(hexToRgb(t.palette.surface.canvas)),
    );
  });

  it.each(BOTH_MODES)('%s mode: veil is a translucent canvas scrim', (mode) => {
    const t = createAppTheme(mode);
    const veil = parseRgba(t.palette.surface.veil);
    const [r, g, b] = hexToRgb(t.palette.surface.canvas);
    expect(veil.r).toBe(r);
    expect(veil.g).toBe(g);
    expect(veil.b).toBe(b);
    expect(veil.a).toBeGreaterThan(0);
    expect(veil.a).toBeLessThan(1);
  });
});

describe('theme token typographic scale', () => {
  it.each(BOTH_MODES)('%s mode defines display, title, body, meta, technical, numerals', (mode) => {
    const t = createAppTheme(mode);
    expect(t.typography.display).toBeDefined();
    expect(t.typography.title).toBeDefined();
    expect(t.typography.body).toBeDefined();
    expect(t.typography.meta).toBeDefined();
    expect(t.typography.technical).toBeDefined();
    expect(t.typography.numerals).toBeDefined();
  });

  it.each(BOTH_MODES)('%s mode: each scale step is at least 1.25x its subordinate', (mode) => {
    const t = createAppTheme(mode);
    const display = toPx(t.typography.display.fontSize);
    const title = toPx(t.typography.title.fontSize);
    const body = toPx(t.typography.body.fontSize);
    const meta = toPx(t.typography.meta.fontSize);
    expect(display / title).toBeGreaterThanOrEqual(1.25);
    expect(title / body).toBeGreaterThanOrEqual(1.25);
    expect(body / meta).toBeGreaterThanOrEqual(1.25);
  });

  it.each(BOTH_MODES)('%s mode: hierarchy is weight-led, one family', (mode) => {
    const t = createAppTheme(mode);
    expect(t.typography.display.fontWeight).toBeGreaterThan(
      t.typography.title.fontWeight as number,
    );
    expect(t.typography.title.fontWeight).toBeGreaterThan(t.typography.body.fontWeight as number);
    expect(t.typography.technical.fontFamily).not.toBe(t.typography.body.fontFamily);
    expect(t.typography.technical.fontFamily).toBe(TECHNICAL_FAMILY);
  });

  it.each(BOTH_MODES)('%s mode: numerals variant sets tabular figures', (mode) => {
    const t = createAppTheme(mode);
    expect(t.typography.numerals.fontVariantNumeric).toBe('tabular-nums');
  });

  it.each(BOTH_MODES)('%s mode: body matter is set at one-and-a-half line height', (mode) => {
    const t = createAppTheme(mode);
    expect(Number(t.typography.body.lineHeight)).toBe(1.5);
  });
});

describe('theme token spacing ladder', () => {
  it.each(BOTH_MODES)('%s mode keeps the 8px spacing base', (mode) => {
    expect(createAppTheme(mode).spacing(1)).toBe('8px');
  });

  it('ladder steps are the spacing multipliers 1x/2x/3x/5x/8x', () => {
    const spacing = createAppTheme('light').spacing;
    expect(SPACE.inline).toBe(spacing(1));
    expect(SPACE.element).toBe(spacing(2));
    expect(SPACE.block).toBe(spacing(3));
    expect(SPACE.zone).toBe(spacing(5));
    expect(SPACE.page).toBe(spacing(8));
  });

  it('ladder is strictly increasing: inline < element < block < zone < page', () => {
    const steps = [SPACE.inline, SPACE.element, SPACE.block, SPACE.zone, SPACE.page].map((v) =>
      parseInt(v, 10),
    );
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i] as number).toBeGreaterThan(steps[i - 1] as number);
    }
  });

  it('measure bounds sustained reading near the text-width reference', () => {
    expect(SPACE.measure).toBeGreaterThanOrEqual(542);
    expect(SPACE.measure).toBeLessThanOrEqual(550);
  });
});

describe('theme token depth steps', () => {
  it.each(BOTH_MODES)(
    '%s mode: rest carries no shadow, hover and float are distinct shadows',
    (mode) => {
      const t = createAppTheme(mode);
      expect(t.depth.rest).toBe('none');
      expect(t.depth.hover).not.toBe('none');
      expect(t.depth.float).not.toBe('none');
      expect(t.depth.hover).not.toBe(t.depth.float);
    },
  );
});

describe('theme token motion tokens', () => {
  it.each(BOTH_MODES)('%s mode defines six durations, all under 500ms', (mode) => {
    const t = createAppTheme(mode);
    const tokens = [
      t.transitions.duration.state,
      t.transitions.duration.reveal,
      t.transitions.duration.float,
      t.transitions.duration.narrow,
      t.transitions.duration.hover,
      t.transitions.duration.switch,
    ];
    expect(tokens.every((d) => d < 500)).toBe(true);
  });

  it.each(BOTH_MODES)('%s mode has one deceleration easing for the whole system', (mode) => {
    const t = createAppTheme(mode);
    expect(t.transitions.easing.decelerate).toMatch(/^cubic-bezier\(/);
  });

  it.each(BOTH_MODES)(
    '%s mode collapses all motion under the reduced-motion preference',
    (mode) => {
      const t = createAppTheme(mode);
      const baseline = styleOverridesOf(t, 'MuiCssBaseline');
      expect(baseline[REDUCED_MOTION_QUERY]).toEqual(REDUCED_MOTION_COLLAPSE);
    },
  );
});

describe('overrides block reads the resolved tokens for both modes', () => {
  it.each(BOTH_MODES)('%s mode: baseline paints the canvas token', (mode) => {
    const t = createAppTheme(mode);
    const baseline = styleOverridesOf(t, 'MuiCssBaseline');
    expect(baseline.body?.backgroundColor).toBe(t.palette.surface.canvas);
  });

  it.each(BOTH_MODES)('%s mode: card hover uses the hover depth and motion tokens', (mode) => {
    const t = createAppTheme(mode);
    const card = styleOverridesOf(t, 'MuiCard').root as Record<string, unknown>;
    const hover = card['&:hover'] as Record<string, unknown>;
    expect(hover.boxShadow).toBe(t.depth.hover);
    expect(String(card.transition)).toContain('box-shadow');
  });

  it.each(BOTH_MODES)('%s mode: dialog paper floats over the veil', (mode) => {
    const t = createAppTheme(mode);
    const dialog = styleOverridesOf(t, 'MuiDialog').paper as Record<string, unknown>;
    expect(dialog.boxShadow).toBe(t.depth.float);
    expect(String(dialog.backgroundColor)).toMatch(/^rgba\(/);
    const backdrop = styleOverridesOf(t, 'MuiBackdrop').root as Record<string, unknown>;
    expect(backdrop.backgroundColor).toBe(t.palette.surface.veil);
  });

  it.each(BOTH_MODES)('%s mode: structure at rest comes from the hairline, not shadows', (mode) => {
    const t = createAppTheme(mode);
    const outlined = styleOverridesOf(t, 'MuiPaper').outlined as Record<string, unknown>;
    expect(outlined.borderColor).toBe(t.palette.line.hairline);
  });
});
