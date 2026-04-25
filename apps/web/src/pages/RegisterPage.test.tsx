import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../auth/AuthContext';
import type { AuthContextValue } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import RegisterPage from './RegisterPage';

const mockRegister = vi.fn();
const mockAuth: AuthContextValue = {
  user: null, bootstrapping: false,
  login: vi.fn(), register: mockRegister, logout: vi.fn(),
};

function renderRegister() {
  const tree = <MemoryRouter><AuthContext.Provider value={mockAuth}><RegisterPage /></AuthContext.Provider></MemoryRouter>;
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
