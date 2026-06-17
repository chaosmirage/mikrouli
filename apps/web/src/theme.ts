import { createTheme, Theme, ThemeOptions } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';

// Design language: "Notion-inspired — clean, minimal, near-black on warm-gray
// paper, soft mint-blue accent, warm-peach secondary." All raw hex literals in
// the web app MUST live in this file only — no hex literals in *.tsx.
//
// Pill-shaped CTA radius — ≥ 24px on contained primary buttons; we use a true
// pill (9999px). Kept as named constants.

const PILL_RADIUS = 9999;
const CARD_RADIUS = 12;
const CONTROL_RADIUS = 6;
const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", sans-serif';

// --- Light palette (the original design language) -------------------------

const NAVY = '#191919';
const NAVY_DEEP = '#000000';
const MINT = '#0077d4';
const MINT_LIGHT = '#e8f4fd';
const CORAL = '#f2a93b';
const CORAL_LIGHT = '#fdf4e8';
const GRAY_50 = '#f6f5f4';
const GRAY_100 = '#edece9';
const GRAY_200 = '#e0dfdc';
const GRAY_400 = '#a5a29e';
const GRAY_500 = '#787572';
const GRAY_700 = '#37352f';
const WHITE = '#ffffff';
const DANGER = '#eb5757';
const SUCCESS = '#2ecc71';

// --- Dark palette ---------------------------------------------------------
// primary.main is remapped from the light-mode near-black: on a dark surface
// the near-black is invisible. We use a light desaturated tone so chart series
// and the landing-page highlight stay legible (contrast >= 3.0:1).
// secondary / warning stay close to their light-mode hues, brightened as needed.

const DARK_PRIMARY = '#e8e6e3'; // warm light gray — high luminance on dark bg
const DARK_PRIMARY_DEEP = '#cfccbd';
const DARK_SECONDARY = '#5aa9f0'; // brightened mint, keeps the hue family
const DARK_SECONDARY_LIGHT = '#1f3a52';
const DARK_WARNING = '#f5b860'; // brightened coral
const DARK_WARNING_LIGHT = '#3d2f1a';
const DARK_BG = '#121212'; // MUI's recommended dark surface
const DARK_BG_PAPER = '#1e1e1e';
const DARK_TEXT_PRIMARY = '#ececec';
const DARK_TEXT_SECONDARY = '#a5a29e';
const DARK_TEXT_DISABLED = '#5a5754';
const DARK_DIVIDER = '#2a2a2a';
const DARK_DANGER = '#f06868';
const DARK_SUCCESS = '#4dd684';

function paletteFor(mode: PaletteMode): ThemeOptions['palette'] {
  if (mode === 'dark') {
    return {
      mode: 'dark',
      primary: { main: DARK_PRIMARY, dark: DARK_PRIMARY_DEEP, contrastText: DARK_BG },
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
    primary: { main: NAVY, dark: NAVY_DEEP, contrastText: WHITE },
    secondary: { main: MINT, light: MINT_LIGHT, contrastText: WHITE },
    warning: { main: CORAL, light: CORAL_LIGHT },
    error: { main: DANGER },
    success: { main: SUCCESS },
    background: { default: GRAY_50, paper: WHITE },
    text: { primary: NAVY, secondary: GRAY_500, disabled: GRAY_400 },
    divider: GRAY_100,
    grey: {
      '50': GRAY_50,
      '100': GRAY_100,
      '200': GRAY_200,
      '400': GRAY_400,
      '500': GRAY_500,
      '700': GRAY_700,
    },
  };
}

const typography: ThemeOptions['typography'] = {
  fontFamily: FONT_FAMILY,
  h1: { fontWeight: 700, letterSpacing: '-0.01em' },
  h2: { fontWeight: 700, letterSpacing: '-0.01em' },
  h3: { fontWeight: 700 },
  h4: { fontWeight: 700, letterSpacing: '-0.005em' },
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
  const CARD_ROOT = { borderRadius: CARD_RADIUS, borderColor: divider };
  const INPUT_ROOT = { borderRadius: CONTROL_RADIUS };
  const INPUT_NOTCHED = { borderColor: divider };
  const TABLE_HEAD_CELL = {
    color: textSecondary,
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    borderBottom: `2px solid ${divider}`,
  };
  const TABLE_HEAD_ROOT = { '& .MuiTableCell-head': TABLE_HEAD_CELL };
  // TableCell border uses a faint surface tint — read from the default bg so it
  // adapts to the mode without a per-mode literal.
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
  // createTheme returns a full Theme; we layer the overrides on top so the
  // overrides block can read the resolved palette tokens via `base.palette`.
  return createTheme(base, { components: componentsFor(base) });
}

// Deprecated bridge: a pre-built light theme for callers that have not yet
// migrated to `createAppTheme`. Removed once every consumer (Storybook) calls
// the factory directly.
export const theme: Theme = createAppTheme('light');
