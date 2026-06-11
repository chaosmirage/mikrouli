import type { Preview } from '@storybook/react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import React from 'react';
import i18next from 'i18next';

// Initialize i18next with all three locales (en/de/el) and their real JSON
// resources. This import mirrors what apps/web/src/main.tsx does at app
// bootstrap, so stories see the same translation tables.
import '../src/i18n';

// The app's single source of theme literals — no inline hex anywhere else.
import { theme } from '../src/theme';

// Locale toolbar descriptor consumed by @storybook/addon-toolbars.
// The toolbar drives i18next.changeLanguage so the Cancel button in
// ConfirmDialog re-renders with the selected locale's translation.
const LOCALE_ITEMS = [
  { value: 'en', title: 'English' },
  { value: 'de', title: 'Deutsch' },
  { value: 'el', title: 'Ελληνικά' },
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
};

// Single global decorator: wraps every story in the app's real MUI theme and
// CssBaseline so components render with the production color/shape tokens.
// OpenTelemetry bootstrap and backend-dependent providers (Router,
// QueryClient, AuthContext) are intentionally absent here; stories that
// need them add per-story decorators.
const withThemeAndI18n: Preview['decorators'][number] = (Story, context) => {
  const locale = context.globals['locale'] as string | undefined;
  if (locale) {
    void i18next.changeLanguage(locale);
  }

  return (
    <ThemeProvider theme={theme}>
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
