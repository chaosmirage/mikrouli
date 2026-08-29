import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../auth/AuthContext';
import type { AuthContextValue } from '../auth/AuthContext';
import RegisterPage from './RegisterPage';

const mockLoginWithGithub = vi.fn();
const mockAuth: AuthContextValue = {
  user: null,
  bootstrapping: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  loginWithGithub: mockLoginWithGithub,
};

function renderRegister(search = '') {
  render(
    <MemoryRouter initialEntries={[`/register${search}`]}>
      <AuthContext.Provider value={mockAuth}>
        <RegisterPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('RegisterPage GitHub button', () => {
  it('renders the "Continue with GitHub" button', () => {
    renderRegister();
    expect(screen.getByTestId('register-github')).toBeInTheDocument();
    expect(screen.getByTestId('register-github')).toHaveTextContent(/Continue with GitHub/i);
  });

  it('clicking the GitHub button calls loginWithGithub', () => {
    renderRegister();
    screen.getByTestId('register-github').click();
    expect(mockLoginWithGithub).toHaveBeenCalledTimes(1);
  });
});

describe('RegisterPage OAuth error query', () => {
  it('shows no error statement when no ?error param is present', () => {
    renderRegister();
    expect(screen.queryByTestId('register-oauth-error')).not.toBeInTheDocument();
  });

  it('shows the no-verified-email statement for the github-no-verified-email slug', () => {
    renderRegister('?error=github-no-verified-email');
    const statement = screen.getByTestId('register-oauth-error');
    expect(statement).toBeInTheDocument();
    // Renders the resolved message, never the raw slug
    expect(statement).toHaveTextContent(/GitHub/i);
    expect(statement).not.toHaveTextContent('github-no-verified-email');
  });

  it('shows the oauth-failed statement for the github-oauth-failed slug', () => {
    renderRegister('?error=github-oauth-failed');
    const statement = screen.getByTestId('register-oauth-error');
    expect(statement).toBeInTheDocument();
    expect(statement).toHaveTextContent(/GitHub/i);
    expect(statement).not.toHaveTextContent('github-oauth-failed');
  });

  it('shows the generic fallback for an unknown error slug', () => {
    renderRegister('?error=some-unknown-slug');
    const statement = screen.getByTestId('register-oauth-error');
    expect(statement).toBeInTheDocument();
    // Unknown slugs must never render the raw param value directly
    expect(statement).not.toHaveTextContent('some-unknown-slug');
  });
});
