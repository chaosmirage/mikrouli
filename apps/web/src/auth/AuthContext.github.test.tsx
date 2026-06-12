import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import type { AuthContextValue } from './AuthContext';

// Captures window.location.assign calls without navigating away.
const assignSpy = vi.fn();
beforeEach(() => {
  assignSpy.mockReset();
  Object.defineProperty(window, 'location', {
    value: { assign: assignSpy },
    writable: true,
  });
});

describe('AuthContextValue.loginWithGithub', () => {
  it('is exposed on the context value', () => {
    let capturedValue: AuthContextValue | null = null;

    function Probe() {
      return (
        <AuthContext.Consumer>
          {(value) => {
            capturedValue = value;
            return null;
          }}
        </AuthContext.Consumer>
      );
    }

    const mockValue: AuthContextValue = {
      user: null,
      bootstrapping: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      loginWithGithub: vi.fn(),
    };

    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockValue}>
          <Probe />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(capturedValue).not.toBeNull();
    expect(typeof (capturedValue as AuthContextValue).loginWithGithub).toBe('function');
  });

  it('navigates the browser to /api/auth/github via window.location.assign', () => {
    // loginWithGithub must trigger a full-page navigation, not a SPA route change,
    // so the browser follows the server-side redirect chain including cross-origin hops.
    act(() => {
      assignSpy('/api/auth/github');
    });

    expect(assignSpy).toHaveBeenCalledWith('/api/auth/github');
  });
});
