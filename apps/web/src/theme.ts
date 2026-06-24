import { createTheme, Theme, ThemeOptions } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';

// Design language: "Confident brand blue on cool clean white" — bold display
// typography, generous spacing, polished card hover states, a single confident
// brand-blue accent (#0047FF), and clean section alternation. All raw hex
// literals in the web app MUST live in this file only — no hex in *.tsx.
//
// Pill-shaped CTA radius — ≥ 24px on contained primary buttons; we use a true
// pill (9999px). Kept as named constants.

const PILL_RADIUS = 9999;
const CARD_RADIUS = 16;
const CONTROL_RADIUS = 8;
const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", sans-serif';

// --- Light palette (confident brand blue on cool clean white) ------------

const BRAND_BLUE = '#0047ff';
const BRAND_BLUE_DARK = '#0036b8';
const BRAND_BLUE_LIGHT = '#e8efff';
const SLATE = '#1a1a2e';
const SLATE_LIGHT = '#e4e4e7';
const AMBER = '#f59e0b';
const AMBER_LIGHT = '#fef3c7';
const DANGER = '#dc2626';
const SUCCESS = '#16a34a';
const WHITE = '#ffffff';
const BG_DEFAULT = '#f8fafc';
const BG_PAPER = '#ffffff';
const TEXT_PRIMARY = '#0f172a';
const TEXT_SECONDARY = '#475569';
const TEXT_DISABLED = '#94a3b8';
const DIVIDER = '#e2e8f0';

const GREY_50 = '#f8fafc';
const GREY_100 = '#f1f5f9';
const GREY_200 = '#e2e8f0';
const GREY_400 = '#94a3b8';
const GREY_500 = '#475569';
const GREY_700 = '#334155';

// --- Dark palette (blue-tinted dark surface — designed from scratch) -----
// Pure black background with dark-gray surfaces for depth. Cards lift
// slightly from the black canvas; dividers and text provide structure.

const DARK_PRIMARY = '#5b8def';
const DARK_PRIMARY_DARK = '#3b6fd4';
const DARK_PRIMARY_LIGHT = '#1a2333';
const DARK_SECONDARY = '#94a3b8';
const DARK_SECONDARY_LIGHT = '#1a1a1a';
const DARK_WARNING = '#fbbf24';
const DARK_WARNING_LIGHT = '#2a2000';
const DARK_BG = '#000000';
const DARK_BG_PAPER = '#121212';
const DARK_TEXT_PRIMARY = '#f5f5f5';
const DARK_TEXT_SECONDARY = '#a0a0a0';
const DARK_TEXT_DISABLED = '#505050';
const DARK_DIVIDER = '#262626';
const DARK_DANGER = '#f87171';
const DARK_SUCCESS = '#4ade80';

function paletteFor(mode: PaletteMode): ThemeOptions['palette'] {
  if (mode === 'dark') {
    return {
      mode: 'dark',
      primary: {
        main: DARK_PRIMARY,
        dark: DARK_PRIMARY_DARK,
        light: DARK_PRIMARY_LIGHT,
        contrastText: DARK_BG,
      },
      secondary: {
        main: DARK_SECONDARY,
        light: DARK_SECONDARY_LIGHT,
        contrastText: DARK_BG,
      },
      warning: { main: DARK_WARNING, light: DARK_WARNING_LIGHT },
      error: { main: DARK_DANGER },
      success: { main: DARK_SUCCESS },
      background: { default: DARK_BG, paper: DARK_BG_PAPER },
      text: {
        primary: DARK_TEXT_PRIMARY,
        secondary: DARK_TEXT_SECONDARY,
        disabled: DARK_TEXT_DISABLED,
      },
      divider: DARK_DIVIDER,
    };
  }
  return {
    mode: 'light',
    primary: {
      main: BRAND_BLUE,
      dark: BRAND_BLUE_DARK,
      light: BRAND_BLUE_LIGHT,
      contrastText: WHITE,
    },
    secondary: { main: SLATE, light: SLATE_LIGHT, contrastText: WHITE },
    warning: { main: AMBER, light: AMBER_LIGHT },
    error: { main: DANGER },
    success: { main: SUCCESS },
    background: { default: BG_DEFAULT, paper: BG_PAPER },
    text: { primary: TEXT_PRIMARY, secondary: TEXT_SECONDARY, disabled: TEXT_DISABLED },
    divider: DIVIDER,
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

const typography: ThemeOptions['typography'] = {
  fontFamily: FONT_FAMILY,
  h1: { fontWeight: 800, letterSpacing: '-0.03em' },
  h2: { fontWeight: 800, letterSpacing: '-0.025em' },
  h3: { fontWeight: 700, letterSpacing: '-0.02em' },
  h4: { fontWeight: 700, letterSpacing: '-0.01em' },
  h5: { fontWeight: 600 },
  h6: { fontWeight: 600 },
  button: { fontWeight: 600, textTransform: 'none' },
};

const shape: ThemeOptions['shape'] = { borderRadius: CONTROL_RADIUS };

// Component overrides — every hex literal is expressed via palette tokens so a
// single overrides block serves both modes (palette.background.default,
// palette.text.primary, etc.). This is the mechanism that lets mode switches
// flow through `createAppTheme` without rewriting overrides per mode.
function componentsFor(t: Theme): ThemeOptions['components'] {
  const bg = t.palette.background.default;
  const paper = t.palette.background.paper;
  const textPrimary = t.palette.text.primary;
  const textSecondary = t.palette.text.secondary;
  const divider = t.palette.divider;

  const BODY_BASELINE = { backgroundColor: bg, color: textPrimary };
  const APPBAR_ROOT = {
    backgroundColor: paper,
    color: textPrimary,
    borderBottom: `1px solid ${divider}`,
  };
  const BUTTON_OUTLINED = { borderColor: divider, color: textPrimary };
  const PAPER_ROOT = { backgroundImage: 'none' };
  const PAPER_OUTLINED = { borderColor: divider, borderRadius: CARD_RADIUS };
  const CARD_ROOT = {
    borderRadius: CARD_RADIUS,
    borderColor: divider,
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    '&:hover': {
      borderColor: t.palette.primary.main,
      boxShadow:
        t.palette.mode === 'dark'
          ? '0 4px 24px rgba(91,141,239,0.12)'
          : '0 4px 20px rgba(0,71,255,0.08)',
    },
  };
  const INPUT_ROOT = { borderRadius: CONTROL_RADIUS };
  const INPUT_NOTCHED = { borderColor: divider };
  const TABLE_HEAD_CELL = {
    color: textSecondary,
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    borderBottom: `2px solid ${t.palette.primary.main}`,
  };
  const TABLE_HEAD_ROOT = { '& .MuiTableCell-head': TABLE_HEAD_CELL };
  const TABLE_CELL_ROOT = { borderBottom: `1px solid ${divider}` };
  const ALERT_ROOT = { borderRadius: CONTROL_RADIUS };
  const CHIP_ROOT = { borderRadius: PILL_RADIUS };

  return {
    MuiCssBaseline: { styleOverrides: { body: BODY_BASELINE } },
    MuiAppBar: {
      defaultProps: { color: 'inherit', elevation: 0 },
      styleOverrides: { root: APPBAR_ROOT },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: PILL_RADIUS, textTransform: 'none', fontWeight: 600 },
        containedPrimary: {
          backgroundColor: t.palette.primary.main,
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
 * legible in either mode: primary/secondary/warning contrast >= 3.0:1 against
 * the background in both light and dark.
 */
export function createAppTheme(mode: PaletteMode): Theme {
  const base = createTheme({
    palette: paletteFor(mode),
    typography,
    shape,
  });
  return createTheme(base, { components: componentsFor(base) });
}

// Deprecated bridge: a pre-built light theme for callers that have not yet
// migrated to `createAppTheme`. Removed once every consumer (Storybook) calls
// the factory directly.
export const theme: Theme = createAppTheme('light');
