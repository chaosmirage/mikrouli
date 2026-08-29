import { createTheme, CSSObject, Theme, ThemeOptions, TypographyStyle } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';

// The form system: every visual value the web app renders is a named token
// defined here -- palette groups (ink ladder, surface trio, one accent,
// hairline), a weight-led typographic scale with a fixed-width technical
// register, a five-step spacing ladder, three depth steps, and six motion
// tokens. One factory serves both color modes through a single overrides
// block that reads the resolved tokens; no raw hex, shadow, or transition
// literal may live outside this file.
//
// Pill-shaped CTA radius — ≥ 24px on contained primary buttons; we use a true
// pill (9999px). Kept as named constants.

const PILL_RADIUS = 9999;
const CARD_RADIUS = 16;
const CONTROL_RADIUS = 8;
const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", sans-serif';
// The technical register: character-exact machine strings (short links, slugs,
// credentials, endpoint terms) read in a fixed-width stack of the same system
// family -- a role, not a second type identity. Exported so consumers assert
// against the token itself instead of restating font literals.
export const TECHNICAL_FAMILY =
  '"SF Mono", "Cascadia Mono", "JetBrains Mono", Menlo, Consolas, "Liberation Mono", monospace';

// --- Token type augmentations ---------------------------------------------

/** Ink ladder: emphasis is bought with luminance step, never a second hue. */
interface InkScale {
  primary: string;
  secondary: string;
  muted: string;
}

/** Surface trio: the canvas ground, the single raised step, the veil scrim. */
interface SurfaceScale {
  canvas: string;
  raised: string;
  veil: string;
}

interface AccentScale {
  solid: string;
}

interface LineScale {
  hairline: string;
}

/** Depth steps: rest (no shadow), hover, and the one elevated float step. */
interface DepthScale {
  rest: string;
  hover: string;
  float: string;
}

/** Named spacing steps over the 8px base, plus the two width bounds: the
 *  reading measure for sustained reading and the wide content zone. */
export interface SpaceScale {
  inline: string;
  element: string;
  block: string;
  zone: string;
  page: string;
  measure: number;
  content: number;
}

declare module '@mui/material/styles' {
  interface Palette {
    ink: InkScale;
    surface: SurfaceScale;
    accent: AccentScale;
    line: LineScale;
  }

  interface PaletteOptions {
    ink?: InkScale;
    surface?: SurfaceScale;
    accent?: AccentScale;
    line?: LineScale;
  }

  interface TypographyVariants {
    display: TypographyStyle;
    title: TypographyStyle;
    body: TypographyStyle;
    meta: TypographyStyle;
    technical: TypographyStyle;
    numerals: TypographyStyle;
  }

  interface TypographyVariantsOptions {
    display?: TypographyStyle;
    title?: TypographyStyle;
    body?: TypographyStyle;
    meta?: TypographyStyle;
    technical?: TypographyStyle;
    numerals?: TypographyStyle;
  }

  interface Duration {
    state: number;
    reveal: number;
    float: number;
    narrow: number;
    hover: number;
    switch: number;
  }

  interface Easing {
    decelerate: string;
  }

  interface Theme {
    depth: DepthScale;
  }

  interface ThemeOptions {
    depth?: DepthScale;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    display: true;
    title: true;
    body: true;
    meta: true;
    technical: true;
    numerals: true;
  }
}

// --- Color helpers ----------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Translucent form of a token color, so the veil and the floating paper stay
 *  derived from their surface step instead of becoming independent literals. */
function rgbaFromHex(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// --- Palette tokens ----------------------------------------------------------

// Light mode: the canvas is the lightest surface; raised sits one clear step
// darker in the same cool near-white family — a visible step, not a whisper,
// while staying lighter than the hairline so outlines keep their place.
const LIGHT_CANVAS = '#f8fafc';
const LIGHT_RAISED = '#ecf0f5';
const LIGHT_VEIL_ALPHA = 0.86;
// Dark mode: the canvas is the darkest surface; raised sits one step lighter —
// far enough above the canvas that rows and cards read at a glance, still a
// calm neutral (zero chroma).
const DARK_CANVAS = '#000000';
const DARK_RAISED = '#1e1e1e';
const DARK_VEIL_ALPHA = 0.72;
// How opaque the floating dialog paper is over the veil: translucent, so the
// kept place beneath stays present.
const FLOATING_PAPER_ALPHA = 0.96;

// Ink ladder (light) -- 7:1 / 4.5:1 / 3:1 floors against canvas and raised.
const LIGHT_INK_PRIMARY = '#0f172a';
const LIGHT_INK_SECONDARY = '#475569';
const LIGHT_INK_MUTED = '#64748b';
const LIGHT_ACCENT = '#0047ff';
const LIGHT_HAIRLINE = '#e2e8f0';

// Ink ladder (dark) -- the same ratio set in the dark realization. The
// hairline rides above the raised surface (not just the canvas) so row
// dividers and outlines stay legible on the lighter raised step.
const DARK_INK_PRIMARY = '#f5f5f5';
const DARK_INK_SECONDARY = '#a0a0a0';
const DARK_INK_MUTED = '#767676';
const DARK_ACCENT = '#5b8def';
const DARK_HAIRLINE = '#333333';

// Accent shades for state changes of the one saturated hue.
const BRAND_BLUE_DARK = '#0036b8';
const BRAND_BLUE_LIGHT = '#e8efff';
const DARK_ACCENT_DARK = '#3b6fd4';
const DARK_ACCENT_LIGHT = '#1a2333';

const SLATE = '#1a1a2e';
const SLATE_LIGHT = '#e4e4e7';
const AMBER = '#f59e0b';
const AMBER_LIGHT = '#fef3c7';
const DANGER = '#dc2626';
const SUCCESS = '#16a34a';
const WHITE = '#ffffff';
const DARK_WARNING = '#fbbf24';
const DARK_WARNING_LIGHT = '#2a2000';
const DARK_SECONDARY = '#94a3b8';
const DARK_SECONDARY_LIGHT = '#1a1a1a';
const DARK_DANGER = '#f87171';
const DARK_SUCCESS = '#4ade80';

const GREY_50 = '#f8fafc';
const GREY_100 = '#f1f5f9';
const GREY_200 = '#e2e8f0';
const GREY_400 = '#94a3b8';
const GREY_500 = '#475569';
const GREY_700 = '#334155';

function paletteFor(mode: PaletteMode): ThemeOptions['palette'] {
  if (mode === 'dark') {
    return {
      mode: 'dark',
      // Named groups -- the tokens every override and sx path reads.
      ink: { primary: DARK_INK_PRIMARY, secondary: DARK_INK_SECONDARY, muted: DARK_INK_MUTED },
      surface: {
        canvas: DARK_CANVAS,
        raised: DARK_RAISED,
        veil: rgbaFromHex(DARK_CANVAS, DARK_VEIL_ALPHA),
      },
      accent: { solid: DARK_ACCENT },
      line: { hairline: DARK_HAIRLINE },
      // Legacy keys mapped onto the tokens so MUI internals (contrastText,
      // disabled states, darkening helpers) keep resolving the same values.
      primary: {
        main: DARK_ACCENT,
        dark: DARK_ACCENT_DARK,
        light: DARK_ACCENT_LIGHT,
        contrastText: DARK_CANVAS,
      },
      secondary: { main: DARK_SECONDARY, light: DARK_SECONDARY_LIGHT, contrastText: DARK_CANVAS },
      warning: { main: DARK_WARNING, light: DARK_WARNING_LIGHT },
      error: { main: DARK_DANGER },
      success: { main: DARK_SUCCESS },
      background: { default: DARK_CANVAS, paper: DARK_RAISED },
      text: {
        primary: DARK_INK_PRIMARY,
        secondary: DARK_INK_SECONDARY,
        disabled: DARK_INK_MUTED,
      },
      divider: DARK_HAIRLINE,
    };
  }
  return {
    mode: 'light',
    ink: { primary: LIGHT_INK_PRIMARY, secondary: LIGHT_INK_SECONDARY, muted: LIGHT_INK_MUTED },
    surface: {
      canvas: LIGHT_CANVAS,
      raised: LIGHT_RAISED,
      veil: rgbaFromHex(LIGHT_CANVAS, LIGHT_VEIL_ALPHA),
    },
    accent: { solid: LIGHT_ACCENT },
    line: { hairline: LIGHT_HAIRLINE },
    primary: {
      main: LIGHT_ACCENT,
      dark: BRAND_BLUE_DARK,
      light: BRAND_BLUE_LIGHT,
      contrastText: WHITE,
    },
    secondary: { main: SLATE, light: SLATE_LIGHT, contrastText: WHITE },
    warning: { main: AMBER, light: AMBER_LIGHT },
    error: { main: DANGER },
    success: { main: SUCCESS },
    background: { default: LIGHT_CANVAS, paper: LIGHT_RAISED },
    text: { primary: LIGHT_INK_PRIMARY, secondary: LIGHT_INK_SECONDARY, disabled: LIGHT_INK_MUTED },
    divider: LIGHT_HAIRLINE,
    grey: {
      '50': GREY_50,
      '100': GREY_100,
      '200': GREY_200,
      '400': GREY_400,
      '500': GREY_500,
      '700': GREY_700,
    },
  };
}

// --- Depth tokens -------------------------------------------------------------

function depthFor(mode: PaletteMode): DepthScale {
  if (mode === 'dark') {
    return {
      rest: 'none',
      hover: '0 4px 24px rgba(91, 141, 239, 0.12)',
      float: '0 16px 48px rgba(0, 0, 0, 0.64)',
    };
  }
  return {
    rest: 'none',
    hover: '0 4px 20px rgba(0, 71, 255, 0.08)',
    float: '0 16px 48px rgba(15, 23, 42, 0.24)',
  };
}

// --- Motion tokens --------------------------------------------------------------

// Each token carries one comprehension purpose and one duration, all under
// half a second, in a single enter-and-settle deceleration family. The switch
// token is the near-instant synchronous substitution itself: no cross-fade on
// a mode or language change, so what is noticed is the unchanged place.
const DECELERATE_EASING = 'cubic-bezier(0, 0, 0.2, 1)';
const MOTION_DURATIONS = {
  state: 150,
  reveal: 250,
  float: 240,
  narrow: 150,
  hover: 200,
  switch: 0,
} as const;

const transitions: ThemeOptions['transitions'] = {
  duration: MOTION_DURATIONS,
  easing: { decelerate: DECELERATE_EASING },
};

/** The single centralized reduced-motion rule: the preference collapses every
 *  motion token to instant while every state remains stated -- motion never
 *  bars operation. Exported with its query key so tests pin the theme's
 *  wiring without restating the media-query literal outside the token owner. */
export const REDUCED_MOTION_QUERY = '@media (prefers-reduced-motion: reduce)';
export const REDUCED_MOTION_COLLAPSE = {
  '*, *::before, *::after': {
    animationDuration: '0.01ms !important',
    animationIterationCount: '1 !important',
    transitionDuration: '0.01ms !important',
    scrollBehavior: 'auto !important',
  },
};

// --- Spacing ladder --------------------------------------------------------------

// One 8px base; five named steps at 1x/2x/3x/5x/8x of it, plus the two width
// bounds. Every gap in the product is one of these steps.
const SPACING_BASE = 8;
const SPACE_STEP_MULTIPLIERS = { inline: 1, element: 2, block: 3, zone: 5, page: 8 } as const;

export const SPACE: SpaceScale = {
  inline: `${SPACING_BASE * SPACE_STEP_MULTIPLIERS.inline}px`,
  element: `${SPACING_BASE * SPACE_STEP_MULTIPLIERS.element}px`,
  block: `${SPACING_BASE * SPACE_STEP_MULTIPLIERS.block}px`,
  zone: `${SPACING_BASE * SPACE_STEP_MULTIPLIERS.zone}px`,
  page: `${SPACING_BASE * SPACE_STEP_MULTIPLIERS.page}px`,
  // The measure bounds the one activity whose visual condition is the measure
  // itself: sustained reading (the legal columns, the landing sections).
  measure: 546,
  // The content zone is the wide width the dashboard set scans — the lg
  // container (1200px) the contained pages always occupied before the token
  // system. A wider viewport buys margins, never longer lines.
  content: 1200,
};

// --- Typographic scale -------------------------------------------------------------

// Four weight-led steps, each at least 1.25x its subordinate; body matter set
// at one-and-a-half line height for sustained reading, display steps tighter.
const DISPLAY_STEP: TypographyStyle = {
  fontFamily: FONT_FAMILY,
  fontSize: '3rem',
  fontWeight: 800,
  letterSpacing: '-0.03em',
  lineHeight: 1.1,
};
const TITLE_STEP: TypographyStyle = {
  fontFamily: FONT_FAMILY,
  fontSize: '2rem',
  fontWeight: 700,
  letterSpacing: '-0.02em',
  lineHeight: 1.2,
};
const BODY_STEP: TypographyStyle = {
  fontFamily: FONT_FAMILY,
  fontSize: '1rem',
  fontWeight: 400,
  lineHeight: 1.5,
};
const META_STEP: TypographyStyle = {
  fontFamily: FONT_FAMILY,
  fontSize: '0.75rem',
  fontWeight: 500,
  letterSpacing: '0.01em',
  lineHeight: 1.5,
};
const TECHNICAL_STEP: TypographyStyle = {
  fontFamily: TECHNICAL_FAMILY,
  fontSize: '0.875rem',
  fontWeight: 400,
  lineHeight: 1.5,
  fontVariantNumeric: 'tabular-nums',
};
// Tabular figures for every standing and total, so comparable values align
// across rows in every locale.
const NUMERALS_STEP: TypographyStyle = { fontVariantNumeric: 'tabular-nums' };

const typography: ThemeOptions['typography'] = {
  fontFamily: FONT_FAMILY,
  // Heading roles restyled onto the same ladder the named variants state.
  h1: DISPLAY_STEP,
  h2: {
    fontFamily: FONT_FAMILY,
    fontSize: '2.5rem',
    fontWeight: 800,
    letterSpacing: '-0.025em',
    lineHeight: 1.15,
  },
  h3: TITLE_STEP,
  h4: {
    fontFamily: FONT_FAMILY,
    fontSize: '1.5rem',
    fontWeight: 700,
    letterSpacing: '-0.01em',
    lineHeight: 1.25,
  },
  h5: { fontFamily: FONT_FAMILY, fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.3 },
  h6: { fontFamily: FONT_FAMILY, fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.35 },
  body1: BODY_STEP,
  body2: { fontFamily: FONT_FAMILY, fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.5 },
  caption: META_STEP,
  button: { fontWeight: 600, textTransform: 'none' },
  // Named roles -- the variants every surface consumes.
  display: DISPLAY_STEP,
  title: TITLE_STEP,
  body: BODY_STEP,
  meta: META_STEP,
  technical: TECHNICAL_STEP,
  numerals: NUMERALS_STEP,
};

const shape: ThemeOptions['shape'] = { borderRadius: CONTROL_RADIUS };

// --- Component overrides -------------------------------------------------------------

// One overrides block for both modes: it reads only resolved tokens, so a mode
// switch flows through the factory without a second block per mode.
function componentsFor(t: Theme): ThemeOptions['components'] {
  const canvas = t.palette.surface.canvas;
  const raised = t.palette.surface.raised;
  const veil = t.palette.surface.veil;
  const inkPrimary = t.palette.ink.primary;
  const inkSecondary = t.palette.ink.secondary;
  const hairline = t.palette.line.hairline;
  const accent = t.palette.accent.solid;
  const paperOverVeil = rgbaFromHex(raised, FLOATING_PAPER_ALPHA);

  const BODY_BASELINE = { backgroundColor: canvas, color: inkPrimary };
  const APPBAR_ROOT = {
    backgroundColor: raised,
    color: inkPrimary,
    borderBottom: `1px solid ${hairline}`,
  };
  const BUTTON_OUTLINED = { borderColor: hairline, color: inkPrimary };
  const PAPER_ROOT = { backgroundImage: 'none' };
  const PAPER_OUTLINED = { borderColor: hairline, borderRadius: CARD_RADIUS };
  const CARD_ROOT = {
    borderRadius: CARD_RADIUS,
    borderColor: hairline,
    transition: t.transitions.create(['border-color', 'box-shadow'], {
      duration: t.transitions.duration.hover,
      easing: t.transitions.easing.decelerate,
    }),
    '&:hover': { borderColor: accent, boxShadow: t.depth.hover },
  };
  // The standing-over moment: translucent paper at the float depth over the
  // veil scrim, so what stands over reads as standing over a kept place.
  const DIALOG_PAPER = {
    backgroundImage: 'none',
    backgroundColor: paperOverVeil,
    border: `1px solid ${hairline}`,
    borderRadius: CARD_RADIUS,
    boxShadow: t.depth.float,
  };
  const BACKDROP_ROOT = { backgroundColor: veil };
  const INPUT_ROOT = { borderRadius: CONTROL_RADIUS };
  const INPUT_NOTCHED = { borderColor: hairline };
  const TABLE_HEAD_CELL: CSSObject = {
    color: inkSecondary,
    fontSize: t.typography.meta.fontSize,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    fontVariantNumeric: 'tabular-nums',
    borderBottom: `2px solid ${accent}`,
  };
  const TABLE_HEAD_ROOT = { '& .MuiTableCell-head': TABLE_HEAD_CELL };
  const TABLE_CELL_ROOT = { borderBottom: `1px solid ${hairline}` };
  const ALERT_ROOT = { borderRadius: CONTROL_RADIUS };
  const CHIP_ROOT = { borderRadius: PILL_RADIUS };

  return {
    MuiCssBaseline: {
      styleOverrides: {
        body: BODY_BASELINE,
        [REDUCED_MOTION_QUERY]: REDUCED_MOTION_COLLAPSE,
      },
    },
    MuiAppBar: {
      defaultProps: { color: 'inherit', elevation: 0 },
      styleOverrides: { root: APPBAR_ROOT },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: PILL_RADIUS, textTransform: 'none', fontWeight: 600 },
        containedPrimary: {
          backgroundColor: accent,
          '&:hover': { backgroundColor: t.palette.primary.dark },
        },
        outlined: BUTTON_OUTLINED,
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: PAPER_ROOT, outlined: PAPER_OUTLINED },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: CARD_ROOT },
    },
    MuiDialog: { styleOverrides: { paper: DIALOG_PAPER } },
    MuiBackdrop: { styleOverrides: { root: BACKDROP_ROOT } },
    MuiOutlinedInput: {
      styleOverrides: { root: INPUT_ROOT, notchedOutline: INPUT_NOTCHED },
    },
    MuiTextField: { defaultProps: { variant: 'outlined', size: 'small' } },
    MuiTableHead: { styleOverrides: { root: TABLE_HEAD_ROOT } },
    MuiTableCell: { styleOverrides: { root: TABLE_CELL_ROOT } },
    MuiAlert: { styleOverrides: { root: ALERT_ROOT } },
    MuiChip: { styleOverrides: { root: CHIP_ROOT } },
  };
}

/**
 * Build the app's MUI theme for a concrete palette mode. Every palette and
 * override reads mode-dependent tokens, so the returned `Theme` is fully
 * legible in either mode: ink ladder at 7:1 / 4.5:1 / 3:1 and the one accent
 * at >= 3:1 against the canvas and raised surfaces, in both light and dark.
 */
export function createAppTheme(mode: PaletteMode): Theme {
  const base = createTheme({
    palette: paletteFor(mode),
    typography,
    shape,
    depth: depthFor(mode),
    transitions,
  });
  return createTheme(base, { components: componentsFor(base) });
}
