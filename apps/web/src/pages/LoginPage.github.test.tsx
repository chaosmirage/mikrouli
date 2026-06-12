import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../auth/AuthContext';
import type { AuthContextValue } from '../auth/AuthContext';
import LoginPage from './LoginPage';

const mockLoginWithGithub = vi.fn();
const mockAuth: AuthContextValue = {
  user: null,
  bootstrapping: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  loginWithGithub: mockLoginWithGithub,
};

function renderLoginAt(search = '') {
  render(
    <MemoryRouter initialEntries={[`/login${search}`]}>
      <AuthContext.Provider value={mockAuth}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('LoginPage GitHub button', () => {
  it('renders the "Continue with GitHub" button', () => {
    renderLoginAt();
    expect(screen.getByTestId('login-github')).toBeInTheDocument();
    expect(screen.getByTestId('login-github')).toHaveTextContent(/Continue with GitHub/i);
  });

  it('clicking the GitHub button calls loginWithGithub', async () => {
    renderLoginAt();
    screen.getByTestId('login-github').click();
    expect(mockLoginWithGithub).toHaveBeenCalledTimes(1);
  });
});

describe('LoginPage OAuth error query', () => {
  it('shows no error alert when no ?error param is present', () => {
    renderLoginAt();
    expect(screen.queryByTestId('login-oauth-error')).not.toBeInTheDocument();
  });

  it('shows the no-verified-email message for github-no-verified-email slug', () => {
    renderLoginAt('?error=github-no-verified-email');
    const alert = screen.getByTestId('login-oauth-error');
    expect(alert).toBeInTheDocument();
    // Renders the i18n value, not the raw slug
    expect(alert).toHaveTextContent(/GitHub/i);
    expect(alert).not.toHaveTextContent('github-no-verified-email');
  });

  it('shows the oauth-failed message for github-oauth-failed slug', () => {
    renderLoginAt('?error=github-oauth-failed');
    const alert = screen.getByTestId('login-oauth-error');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/GitHub/i);
    expect(alert).not.toHaveTextContent('github-oauth-failed');
  });

  it('shows a generic fallback for an unknown error slug', () => {
    renderLoginAt('?error=some-unknown-slug');
    const alert = screen.getByTestId('login-oauth-error');
    expect(alert).toBeInTheDocument();
    // Unknown slugs must never render the raw param value directly
    expect(alert).not.toHaveTextContent('some-unknown-slug');
  });
});
