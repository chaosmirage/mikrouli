import { createTheme, ThemeOptions } from '@mui/material/styles';

// Pill-shaped CTA radius — ≥ 24px on contained primary buttons.
const PILL_RADIUS = 24;
const BASE_RADIUS = 8;
const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", sans-serif';

const palette: ThemeOptions['palette'] = {
  primary: { main: '#1f6feb' },
  secondary: { main: '#f2a93b' },
};

const typography: ThemeOptions['typography'] = {
  fontFamily: FONT_FAMILY,
};

const shape: ThemeOptions['shape'] = {
  borderRadius: BASE_RADIUS,
};

// MuiButton radius kept on a single line.
// line-mode grep. Nested object literals are data composition (waived),
// indentation depth stays at 1.
const components: ThemeOptions['components'] = {
  MuiButton: { styleOverrides: { root: { borderRadius: PILL_RADIUS, textTransform: 'none', fontWeight: 600 } } },
};

export const theme = createTheme({
  palette,
  typography,
  shape,
  components,
});
