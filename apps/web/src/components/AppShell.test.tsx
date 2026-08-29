import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../auth/AuthContext';
import type { AuthContextValue } from '../auth/AuthContext';
import { ThemeModeContext } from '../theme-mode-context';
import type { ThemeModeContextValue } from '../theme-mode-context';
import AppShell from './AppShell';

const guestAuth: AuthContextValue = {
  user: null,
  bootstrapping: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  loginWithGithub: vi.fn(),
};

const authedAuth: AuthContextValue = {
  user: { id: '1', email: 'user@example.com', createdAt: '' },
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

function renderShell(authValue: AuthContextValue) {
  render(
    <MemoryRouter>
      <AuthContext.Provider value={authValue}>
        <ThemeModeContext.Provider value={themeValue}>
          <AppShell />
        </ThemeModeContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('AppShell', () => {
  it('shows Login and Register when not authenticated', () => {
    renderShell(guestAuth);
    expect(screen.getByTestId('nav-login')).toBeInTheDocument();
    expect(screen.getByTestId('nav-register')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-logout')).not.toBeInTheDocument();
  });

  it('shows Dashboard and Logout when authenticated', () => {
    renderShell(authedAuth);
    expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('nav-logout')).toBeInTheDocument();
    expect(screen.getByTestId('nav-user-email')).toHaveTextContent('user@example.com');
    expect(screen.queryByTestId('nav-login')).not.toBeInTheDocument();
  });

  it('shows the hamburger menu button alongside inline nav buttons when authenticated', () => {
    renderShell(authedAuth);
    expect(screen.getByTestId('nav-menu-button')).toBeInTheDocument();
    expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('nav-api-keys')).toBeInTheDocument();
    expect(screen.getByTestId('nav-usage')).toBeInTheDocument();
    expect(screen.getByTestId('nav-logout')).toBeInTheDocument();
  });

  it('shows the hamburger menu button alongside inline nav buttons when not authenticated', () => {
    renderShell(guestAuth);
    expect(screen.getByTestId('nav-menu-button')).toBeInTheDocument();
    expect(screen.getByTestId('nav-login')).toBeInTheDocument();
    expect(screen.getByTestId('nav-register')).toBeInTheDocument();
  });

  it('renders the global footer with all three links when not authenticated', () => {
    renderShell(guestAuth);
    expect(screen.getByTestId('footer')).toBeInTheDocument();
    expect(screen.getByTestId('footer-terms')).toBeInTheDocument();
    expect(screen.getByTestId('footer-privacy')).toBeInTheDocument();
    const contact = screen.getByTestId('footer-contact');
    expect(contact).toBeInTheDocument();
    expect(contact).toHaveAttribute('href', 'mailto:support@mikrou.li');
  });

  it('renders the global footer with all three links when authenticated', () => {
    renderShell(authedAuth);
    expect(screen.getByTestId('footer')).toBeInTheDocument();
    expect(screen.getByTestId('footer-terms')).toBeInTheDocument();
    expect(screen.getByTestId('footer-privacy')).toBeInTheDocument();
    const contact = screen.getByTestId('footer-contact');
    expect(contact).toBeInTheDocument();
    expect(contact).toHaveAttribute('href', 'mailto:support@mikrou.li');
  });

  it('renders footer on all pages', () => {
    renderShell(guestAuth);
    expect(screen.getByTestId('footer')).toBeInTheDocument();
    expect(screen.getByTestId('footer-terms')).toBeInTheDocument();
    expect(screen.getByTestId('footer-privacy')).toBeInTheDocument();
    expect(screen.getByTestId('footer-contact')).toBeInTheDocument();
  });

  it('keeps nav actions in a single horizontal row at all viewport widths', () => {
    renderShell(guestAuth);
    const navActions = screen.getByTestId('nav-actions');
    expect(navActions).toHaveStyle({ flexDirection: 'row' });
  });

  it('carries the color-mode and language reaches in the shell band', () => {
    renderShell(guestAuth);
    expect(screen.getByTestId('settings-mode-reach')).toBeInTheDocument();
    expect(screen.getByTestId('settings-language-reach')).toBeInTheDocument();
  });

  it('one activation of a settings reach opens the setting pair over the kept place', () => {
    renderShell(guestAuth);
    fireEvent.click(screen.getByTestId('settings-mode-reach'));
    expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
    // The place beneath the veil is kept: the content and footer still stand.
    expect(screen.getByTestId('page-content')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('retires the superseded inline selectors from the shell band', () => {
    renderShell(guestAuth);
    expect(screen.queryByTestId('theme-mode-switcher')).not.toBeInTheDocument();
    expect(screen.queryByTestId('locale-switcher')).not.toBeInTheDocument();
  });
});
