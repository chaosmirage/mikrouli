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

function renderRegister() {
  render(
    <MemoryRouter>
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
