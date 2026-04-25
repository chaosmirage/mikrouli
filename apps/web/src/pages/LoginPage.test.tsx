import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../auth/AuthContext';
import type { AuthContextValue } from '../auth/AuthContext';
import LoginPage from './LoginPage';

const mockLogin = vi.fn();
const mockAuth: AuthContextValue = {
  user: null,
  bootstrapping: false,
  login: mockLogin,
  register: vi.fn(),
  logout: vi.fn(),
};

function renderLogin() {
  const tree = (
    <MemoryRouter>
      <AuthContext.Provider value={mockAuth}>
        <LoginPage />
      </AuthContext.Provider>
    </MemoryRouter>
  );
  render(tree);
}

beforeEach(() => {
  mockLogin.mockReset();
  mockLogin.mockResolvedValue(undefined);
});

describe('LoginPage', () => {
  it('renders email, password, and submit fields', () => {
    renderLogin();
    expect(screen.getByTestId('login-email')).toBeInTheDocument();
    expect(screen.getByTestId('login-password')).toBeInTheDocument();
    expect(screen.getByTestId('login-submit')).toBeInTheDocument();
  });

  it('submitting calls login with email and password', async () => {
    renderLogin();
    fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByTestId('login-password'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByTestId('login-submit'));
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('user@test.com', 'secret'));
  });

  it('shows error alert on login failure', async () => {
    mockLogin.mockRejectedValue(
      Object.assign(new Error('Invalid email or password'), { status: 401 }),
    );
    renderLogin();
    fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'bad@test.com' } });
    fireEvent.change(screen.getByTestId('login-password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByTestId('login-submit'));
    await waitFor(() => expect(screen.getByTestId('login-error')).toBeInTheDocument());
  });
});
