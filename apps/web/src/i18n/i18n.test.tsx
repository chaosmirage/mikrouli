import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import i18next from 'i18next';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../auth/AuthContext';
import type { AuthContextValue } from '../auth/AuthContext';
import { ThemeModeContext } from '../theme-mode-context';
import type { ThemeModeContextValue } from '../theme-mode-context';
import AppShell from '../components/AppShell';

const guestAuth: AuthContextValue = {
  user: null,
  bootstrapping: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  loginWithGithub: vi.fn(),
};

const themeValue: ThemeModeContextValue = {
  mode: 'follow-system',
  effectiveMode: 'light',
  setMode: vi.fn(),
};

function renderShell() {
  render(
    <MemoryRouter>
      <AuthContext.Provider value={guestAuth}>
        <ThemeModeContext.Provider value={themeValue}>
          <AppShell />
        </ThemeModeContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('locale switching', () => {
  afterEach(async () => {
    await act(async () => {
      await i18next.changeLanguage('en');
    });
  });

  it('the language reach renders in the app shell', () => {
    renderShell();
    expect(screen.getByTestId('settings-language-reach')).toBeInTheDocument();
  });

  it('switching to de renders German nav labels', async () => {
    renderShell();
    await act(async () => {
      await i18next.changeLanguage('de');
    });
    expect(screen.getByText('Anmelden')).toBeInTheDocument();
    expect(screen.getByText('Registrieren')).toBeInTheDocument();
  });

  it('switching to el renders Greek nav labels', async () => {
    renderShell();
    await act(async () => {
      await i18next.changeLanguage('el');
    });
    expect(screen.getByText('Σύνδεση')).toBeInTheDocument();
    expect(screen.getByText('Εγγραφή')).toBeInTheDocument();
  });

  it('switching back to en renders English nav labels', async () => {
    await act(async () => {
      await i18next.changeLanguage('de');
    });
    renderShell();
    await act(async () => {
      await i18next.changeLanguage('en');
    });
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });
});
