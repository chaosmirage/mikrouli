import type { Preview } from '@storybook/react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import React from 'react';
import i18next from 'i18next';

// Initialize i18next with all three locales (en/de/el) and their real JSON
// resources. This import mirrors what apps/web/src/main.tsx does at app
// bootstrap, so stories see the same translation tables.
import '../src/i18n';

// The app's single source of theme construction — no inline hex anywhere else.
import { createAppTheme } from '../src/theme';

// Locale + theme toolbar descriptors consumed by @storybook/addon-toolbars.
// The locale toolbar drives i18next.changeLanguage; the theme toolbar feeds
// createAppTheme so stories render with the production palette tokens for the
// selected mode.
const LOCALE_ITEMS = [
  { value: 'en', title: 'English' },
  { value: 'de', title: 'Deutsch' },
  { value: 'el', title: 'Ελληνικά' },
];

const THEME_ITEMS = [
  { value: 'light', title: 'Light' },
  { value: 'dark', title: 'Dark' },
];

const globalTypes: Preview['globalTypes'] = {
  locale: {
    name: 'Locale',
    description: 'Internationalization locale',
    defaultValue: 'en',
    toolbar: {
      icon: 'globe',
      items: LOCALE_ITEMS,
      showName: true,
    },
  },
  theme: {
    name: 'Theme',
    description: 'Visual mode (light / dark)',
    defaultValue: 'light',
    toolbar: {
      icon: 'circlehollow',
      items: THEME_ITEMS,
      showName: true,
    },
  },
};

// Single global decorator: wraps every story in the app's real MUI theme and
// CssBaseline so components render with the production color/shape tokens for
// the toolbar-selected mode. OpenTelemetry bootstrap and backend-dependent
// providers (Router, QueryClient, AuthContext) are intentionally absent here;
// stories that need them add per-story decorators.
const withThemeAndI18n: Preview['decorators'][number] = (Story, context) => {
  const locale = context.globals['locale'] as string | undefined;
  if (locale) {
    void i18next.changeLanguage(locale);
  }
  const themeMode = (context.globals['theme'] as 'light' | 'dark' | undefined) ?? 'light';

  return (
    <ThemeProvider theme={createAppTheme(themeMode)}>
      <CssBaseline />
      <Story />
    </ThemeProvider>
  );
};

const preview: Preview = {
  globalTypes,
  decorators: [withThemeAndI18n],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
