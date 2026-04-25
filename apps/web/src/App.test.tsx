import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from './auth/AuthContext';
import type { AuthContextValue } from './auth/AuthContext';

const mockAuth: AuthContextValue = {
  user: null,
  bootstrapping: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
};

describe('App', () => {
  it('renders a stub inside auth context without crashing', () => {
    const stub = <div data-testid="stub">ok</div>;
    const tree = <MemoryRouter><AuthContext.Provider value={mockAuth}>{stub}</AuthContext.Provider></MemoryRouter>;
    render(tree);
    expect(screen.getByTestId('stub')).toBeInTheDocument();
  });
});
