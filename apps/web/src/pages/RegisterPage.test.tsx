import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../auth/AuthContext';
import type { AuthContextValue } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import RegisterPage from './RegisterPage';

const mockRegister = vi.fn();
const mockAuth: AuthContextValue = {
  user: null,
  bootstrapping: false,
  login: vi.fn(),
  register: mockRegister,
  logout: vi.fn(),
  loginWithGithub: vi.fn(),
};

// A router entry, optionally carrying arrival state (as the register offer's
// accept reach does when it opens the entering).
type RouteEntry = string | { pathname: string; state?: Record<string, unknown> };

function renderRegister(entry: RouteEntry = '/register') {
  const tree = (
    <MemoryRouter initialEntries={[entry]}>
      <AuthContext.Provider value={mockAuth}>
        <RegisterPage />
      </AuthContext.Provider>
    </MemoryRouter>
  );
  render(tree);
}

beforeEach(() => {
  mockRegister.mockReset();
  mockRegister.mockResolvedValue(undefined);
});

describe('RegisterPage', () => {
  it('renders email, password, and submit fields', () => {
    renderRegister();
    expect(screen.getByTestId('register-email')).toBeInTheDocument();
    expect(screen.getByTestId('register-password')).toBeInTheDocument();
    expect(screen.getByTestId('register-submit')).toBeInTheDocument();
  });

  it('stages the federated path before the credentials path', () => {
    renderRegister();
    const federated = screen.getByTestId('register-github');
    const addressEntering = screen.getByTestId('register-email');
    const follows =
      federated.compareDocumentPosition(addressEntering) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(follows).toBeTruthy();
  });

  it('restates the kept-link stake in one line when arrival follows the accepted register offer', () => {
    renderRegister({ pathname: '/register', state: { fromRegisterOffer: true } });
    expect(screen.getByTestId('register-kept-link')).toBeInTheDocument();
  });

  it('shows no kept-link stake on a direct arrival', () => {
    renderRegister();
    expect(screen.queryByTestId('register-kept-link')).not.toBeInTheDocument();
  });

  it('submitting calls register with email and password', async () => {
    renderRegister();
    fireEvent.change(screen.getByTestId('register-email'), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByTestId('register-password'), { target: { value: 'Password1' } });
    fireEvent.click(screen.getByTestId('register-submit'));
    await waitFor(() => expect(mockRegister).toHaveBeenCalledWith('user@test.com', 'Password1'));
  });

  it('shows client validation error for short password', async () => {
    renderRegister();
    fireEvent.change(screen.getByTestId('register-email'), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByTestId('register-password'), { target: { value: 'short' } });
    fireEvent.click(screen.getByTestId('register-submit'));
    await waitFor(() => expect(screen.getByText(/≥8 chars/i)).toBeInTheDocument());
  });

  it('shows server error on 409 duplicate email', async () => {
    const conflict = new ApiError(409, 'Conflict');
    mockRegister.mockRejectedValue(conflict);
    renderRegister();
    fireEvent.change(screen.getByTestId('register-email'), { target: { value: 'dup@test.com' } });
    fireEvent.change(screen.getByTestId('register-password'), { target: { value: 'Password1' } });
    fireEvent.click(screen.getByTestId('register-submit'));
    await waitFor(() => expect(screen.getByTestId('register-server-error')).toBeInTheDocument());
    expect(screen.getByText(/Email already registered/i)).toBeInTheDocument();
  });
});
