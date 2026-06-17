/* eslint-disable react-refresh/only-export-components */
import './instrumentation';
import './i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import App from './App';
import { createAppTheme } from './theme';
import { ThemeModeProvider, useThemeMode } from './theme-mode-context';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

// Inner layer: reads the resolved effective mode and produces the concrete
// MUI theme on every render. Sits BELOW ThemeModeProvider so it can call
// useThemeMode; sits ABOVE BrowserRouter so theme applies to every route.
function ThemedApp() {
  const { effectiveMode } = useThemeMode();
  return (
    <ThemeProvider theme={createAppTheme(effectiveMode)}>
      <CssBaseline />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  );
}

const tree = (
  <StrictMode>
    <ThemeModeProvider>
      <ThemedApp />
    </ThemeModeProvider>
  </StrictMode>
);

createRoot(rootElement).render(tree);
