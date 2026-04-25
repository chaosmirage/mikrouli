import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import App from './App';
import { theme } from './theme';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

const router = (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

const themed = (
  <ThemeProvider theme={theme}>
    <CssBaseline />
    {router}
  </ThemeProvider>
);

const tree = <StrictMode>{themed}</StrictMode>;

createRoot(rootElement).render(tree);
