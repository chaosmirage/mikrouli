import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { AuthContext } from '../auth/AuthContext';
import type { AuthContextValue } from '../auth/AuthContext';
import { TestQueryClientProvider } from '../test/queryClient';
import LandingPage from './LandingPage';
import { theme } from '../theme';

// Anonymous visitor context (the only audience for the guest shorten form).
const mockAuth: AuthContextValue = {
  user: null,
  bootstrapping: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  loginWithGithub: vi.fn(),
};

function makeConfigResponse(body: string) {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(body),
  };
}

beforeEach(() => {
  // Default: GUEST_SHORTEN_ENABLED=false so the guest section stays hidden.
  // Per-test overrides re-stub fetch to flip the flag.
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        makeConfigResponse('window.__MIKROULI_CONFIG__ = { guestShortenEnabled: false };\n'),
      ),
  );
});

function renderLanding() {
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <AuthContext.Provider value={mockAuth}>
          <TestQueryClientProvider>
            <LandingPage />
          </TestQueryClientProvider>
        </AuthContext.Provider>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('LandingPage', () => {
  it('renders the three hero sections', () => {
    renderLanding();
    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    expect(screen.getByTestId('landing-hero')).toBeInTheDocument();
    expect(screen.getByTestId('landing-features')).toBeInTheDocument();
    expect(screen.getByTestId('landing-bottom-cta')).toBeInTheDocument();
  });

  it('renders three feature cards', () => {
    renderLanding();
    expect(screen.getByTestId('landing-feature-1')).toBeInTheDocument();
    expect(screen.getByTestId('landing-feature-2')).toBeInTheDocument();
    expect(screen.getByTestId('landing-feature-3')).toBeInTheDocument();
  });

  it('hero CTA buttons link to register and login', () => {
    renderLanding();
    const registerCta = screen.getByTestId('landing-cta-register');
    const loginCta = screen.getByTestId('landing-cta-login');
    expect(registerCta).toHaveAttribute('href', '/register');
    expect(loginCta).toHaveAttribute('href', '/login');
  });

  it('bottom CTA links to register', () => {
    renderLanding();
    const cta = screen.getByTestId('landing-bottom-cta-register');
    expect(cta).toHaveAttribute('href', '/register');
  });

  it('headline contains both prefix and highlight text', () => {
    renderLanding();
    const headline = screen.getByTestId('landing-headline');
    expect(headline).toHaveTextContent(/Shorten your links/i);
    expect(headline).toHaveTextContent(/track every click/i);
  });

  describe('agent section', () => {
    it('renders the agent section between features and bottom CTA', () => {
      renderLanding();
      const page = screen.getByTestId('landing-page');
      const sections = page.querySelectorAll('[data-testid]');
      const ids = Array.from(sections).map((el) => el.getAttribute('data-testid'));
      const featIdx = ids.indexOf('landing-features');
      const agentIdx = ids.indexOf('agent-section');
      const bottomIdx = ids.indexOf('landing-bottom-cta');
      expect(agentIdx).toBeGreaterThan(-1);
      expect(agentIdx).toBeGreaterThan(featIdx);
      expect(agentIdx).toBeLessThan(bottomIdx);
    });

    it('agent section links to /connect', () => {
      renderLanding();
      const section = screen.getByTestId('agent-section');
      // The CTA anchor inside the section must point to /connect
      const connectLink = within(section).getByRole('link', { name: /connect/i });
      expect(connectLink).toHaveAttribute('href', '/connect');
    });

    it('agent section names REST and MCP', () => {
      renderLanding();
      const section = screen.getByTestId('agent-section');
      expect(section).toHaveTextContent(/REST/i);
      expect(section).toHaveTextContent(/MCP/i);
    });
  });

  describe('guest shorten section', () => {
    it('is hidden when the runtime flag is off', () => {
      renderLanding();
      expect(screen.queryByTestId('guest-shorten-section')).not.toBeInTheDocument();
    });

    it('renders the shorten card when the runtime flag is on and visitor is anonymous', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            makeConfigResponse('window.__MIKROULI_CONFIG__ = { guestShortenEnabled: true };\n'),
          ),
      );
      const { waitFor } = await import('@testing-library/react');
      renderLanding();
      await waitFor(() => expect(screen.getByTestId('guest-shorten-section')).toBeInTheDocument());
      expect(screen.getByTestId('shorten-url')).toBeInTheDocument();
      // The nudge is hidden until a Guest shorten succeeds.
      expect(screen.queryByTestId('guest-nudge')).not.toBeInTheDocument();
    });
  });
});
