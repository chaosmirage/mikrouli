import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import App from './App';
import { SPACE, createAppTheme } from './theme';
import { ThemeModeProvider } from './theme-mode-context';
import { AuthContext } from './auth/AuthContext';
import type { AuthContextValue } from './auth/AuthContext';

const mockAuth: AuthContextValue = {
  user: null,
  bootstrapping: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  loginWithGithub: vi.fn(),
};

describe('App', () => {
  it('renders a stub inside auth context without crashing', () => {
    const stub = <div data-testid="stub">ok</div>;
    const tree = (
      <MemoryRouter>
        <AuthContext.Provider value={mockAuth}>{stub}</AuthContext.Provider>
      </MemoryRouter>
    );
    render(tree);
    expect(screen.getByTestId('stub')).toBeInTheDocument();
  });

  it('renders the not-found statement for an unknown path instead of an empty document', async () => {
    // A visitor at an address no route answers still gets the shell with the
    // resolved statement inside it — navigation survives, the document is
    // never blank. The auth bootstrap probe resolves before the route
    // settles, hence findBy.
    render(
      <ThemeModeProvider>
        <ThemeProvider theme={createAppTheme('light')}>
          <MemoryRouter initialEntries={['/no-such-address']}>
            <App />
          </MemoryRouter>
        </ThemeProvider>
      </ThemeModeProvider>,
    );
    const statement = await screen.findByTestId('not-found-statement');
    expect(statement).toBeInTheDocument();
    // The statement stands inside the shell, so the app bar survives it.
    expect(screen.getByTestId('app-bar')).toBeInTheDocument();
  });

  it('bounds the contained layout at the wide content token, never the reading measure', async () => {
    // A user opening any contained page (here /login) sees the shared content
    // column: the wide zone the dashboard set scans, not the reading measure
    // that bounds only sustained reading (the legal columns bound themselves).
    // The auth bootstrap probe resolves before the route settles, hence findBy.
    render(
      <ThemeModeProvider>
        <ThemeProvider theme={createAppTheme('light')}>
          <MemoryRouter initialEntries={['/login']}>
            <App />
          </MemoryRouter>
        </ThemeProvider>
      </ThemeModeProvider>,
    );
    const layout = await screen.findByTestId('contained-layout');
    expect(layout).toHaveStyle({ maxWidth: `${SPACE.content}px` });
    // The measure must not leak back into the content zone.
    expect(SPACE.content).not.toBe(SPACE.measure);
  });
});
