import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import type { AuthContextValue } from './AuthContext';
import GuestRoute from './GuestRoute';

const guestAuth: AuthContextValue = {
  user: null,
  bootstrapping: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
};

const authedAuth: AuthContextValue = {
  user: { id: '1', email: 'user@example.com', createdAt: '' },
  bootstrapping: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
};

const bootstrappingAuth: AuthContextValue = {
  user: null,
  bootstrapping: true,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
};

function renderAt(authValue: AuthContextValue, path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={authValue}>
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path="/" element={<div data-testid="public-content">PUBLIC</div>} />
          </Route>
          <Route path="/dashboard" element={<div data-testid="dashboard-content">DASH</div>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('GuestRoute', () => {
  it('renders the child outlet when no user is signed in', () => {
    renderAt(guestAuth, '/');
    expect(screen.getByTestId('public-content')).toBeInTheDocument();
  });

  it('redirects an authenticated user to the dashboard', () => {
    renderAt(authedAuth, '/');
    expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
    expect(screen.queryByTestId('public-content')).not.toBeInTheDocument();
  });

  it('shows a bootstrap spinner while auth is loading', () => {
    renderAt(bootstrappingAuth, '/');
    expect(screen.getByTestId('auth-bootstrapping')).toBeInTheDocument();
  });
});
