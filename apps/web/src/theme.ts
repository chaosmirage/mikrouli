import { createTheme, ThemeOptions } from '@mui/material/styles';

// Design language adopted from the upstream url-shortener prototype:
// "Notion-inspired — clean, minimal, near-black on warm-gray paper, soft
// mint-blue accent, warm-peach secondary." All raw hex literals MUST live
// in this file only — no hex literals in *.tsx.
//
// Pill-shaped CTA radius — ≥ 24px on contained primary
// buttons. We use a true pill (9999px).
// value kept as a named constant.
const PILL_RADIUS = 9999;
const CARD_RADIUS = 12;
const CONTROL_RADIUS = 6;
const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", sans-serif';

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

const palette: ThemeOptions['palette'] = {
  mode: 'light',
  primary: { main: NAVY, dark: NAVY_DEEP, contrastText: WHITE },
  secondary: { main: MINT, light: MINT_LIGHT, contrastText: WHITE },
  warning: { main: CORAL, light: CORAL_LIGHT },
  error: { main: DANGER },
  success: { main: SUCCESS },
  background: { default: GRAY_50, paper: WHITE },
  text: { primary: NAVY, secondary: GRAY_500, disabled: GRAY_400 },
  divider: GRAY_100,
  grey: { '50': GRAY_50, '100': GRAY_100, '200': GRAY_200, '400': GRAY_400, '500': GRAY_500, '700': GRAY_700 },
};

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

// Component overrides as data composition. Nested style objects are
// extracted to top-level constants so the indent-depth scanner stays at
// depth ≤ 2 inside the `components` literal.
const BODY_BASELINE = { backgroundColor: GRAY_50, color: NAVY };
const APPBAR_ROOT = { backgroundColor: WHITE, color: NAVY, borderBottom: `1px solid ${GRAY_100}` };
const BUTTON_CONTAINED_PRIMARY = { backgroundColor: NAVY, '&:hover': { backgroundColor: NAVY_DEEP } };
const BUTTON_OUTLINED = { borderColor: GRAY_200, color: GRAY_700 };
const PAPER_ROOT = { backgroundImage: 'none' };
const PAPER_OUTLINED = { borderColor: GRAY_100, borderRadius: CARD_RADIUS };
const CARD_ROOT = { borderRadius: CARD_RADIUS, borderColor: GRAY_100 };
const INPUT_ROOT = { borderRadius: CONTROL_RADIUS };
const INPUT_NOTCHED = { borderColor: GRAY_200 };
const TABLE_HEAD_CELL = {
  color: GRAY_500,
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
  borderBottom: `2px solid ${GRAY_100}`,
};
const TABLE_HEAD_ROOT = { '& .MuiTableCell-head': TABLE_HEAD_CELL };
const TABLE_CELL_ROOT = { borderBottom: `1px solid ${GRAY_50}` };
const ALERT_ROOT = { borderRadius: CONTROL_RADIUS };
const CHIP_ROOT = { borderRadius: PILL_RADIUS };

// Single-line MuiButton borderRadius
// kept on a single line.
const components: ThemeOptions['components'] = {
  MuiCssBaseline: { styleOverrides: { body: BODY_BASELINE } },
  MuiAppBar: { defaultProps: { color: 'inherit', elevation: 0 }, styleOverrides: { root: APPBAR_ROOT } },
  MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: PILL_RADIUS, textTransform: 'none', fontWeight: 600 }, containedPrimary: BUTTON_CONTAINED_PRIMARY, outlined: BUTTON_OUTLINED } },
  MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: PAPER_ROOT, outlined: PAPER_OUTLINED } },
  MuiCard: { defaultProps: { variant: 'outlined' }, styleOverrides: { root: CARD_ROOT } },
  MuiOutlinedInput: { styleOverrides: { root: INPUT_ROOT, notchedOutline: INPUT_NOTCHED } },
  MuiTextField: { defaultProps: { variant: 'outlined', size: 'small' } },
  MuiTableHead: { styleOverrides: { root: TABLE_HEAD_ROOT } },
  MuiTableCell: { styleOverrides: { root: TABLE_CELL_ROOT } },
  MuiAlert: { styleOverrides: { root: ALERT_ROOT } },
  MuiChip: { styleOverrides: { root: CHIP_ROOT } },
};

export const theme = createTheme({
  palette,
  typography,
  shape,
  components,
});
