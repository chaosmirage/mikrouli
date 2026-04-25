import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../auth/AuthContext';
import type { AuthContextValue } from '../auth/AuthContext';
import AppShell from './AppShell';

const guestAuth: AuthContextValue = {
  user: null, bootstrapping: false,
  login: vi.fn(), register: vi.fn(), logout: vi.fn(),
};

const authedAuth: AuthContextValue = {
  user: { id: '1', email: 'user@example.com', createdAt: '' },
  bootstrapping: false,
  login: vi.fn(), register: vi.fn(), logout: vi.fn(),
};

function renderShell(authValue: AuthContextValue) {
  render(<MemoryRouter><AuthContext.Provider value={authValue}><AppShell /></AuthContext.Provider></MemoryRouter>);
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
});
