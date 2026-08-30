import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { AuthContext } from '../auth/AuthContext';
import type { AuthContextValue } from '../auth/AuthContext';
import { TestQueryClientProvider } from '../test/queryClient';
import { createAppTheme } from '../theme';
import LandingPage from './LandingPage';

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
  // Default: GUEST_SHORTEN_ENABLED=false so the guest act stays hidden.
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
    <ThemeProvider theme={createAppTheme('light')}>
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

// The rendered page, in DOM order, as the collection of its test ids.
function renderedSectionIds(): string[] {
  const page = screen.getByTestId('landing-page');
  const sections = page.querySelectorAll('[data-testid]');
  return Array.from(sections).map((el) => el.getAttribute('data-testid') ?? '');
}

describe('LandingPage', () => {
  it('renders the first-sight statement as the page heading with its supporting line', () => {
    renderLanding();
    const statement = screen.getByTestId('landing-statement');
    const heading = within(statement).getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent(/Shorten anything/i);
    expect(statement).toHaveTextContent(/no account needed/i);
  });

  it('renders the claims band as one grid of four comparable entries', () => {
    renderLanding();
    const band = screen.getByTestId('landing-claims');
    const entries = band.querySelectorAll('[data-testid^="landing-claim-"]:not([data-testid$="-reach"])');
    expect(entries).toHaveLength(4);
  });

  it('each claim names its compared analog', () => {
    renderLanding();
    const band = screen.getByTestId('landing-claims');
    // Free analytics depth vs the tier-gated incumbent.
    expect(within(band).getByTestId('landing-claim-analytics')).toHaveTextContent(/Bitly/i);
    // Both QR representations vs the platforms that sell them.
    expect(within(band).getByTestId('landing-claim-qr')).toHaveTextContent(/sell QR codes/i);
    // Agent access vs the paywalled, script-only API access.
    expect(within(band).getByTestId('landing-claim-agents')).toHaveTextContent(/API access/i);
    // Three-language operation.
    expect(within(band).getByTestId('landing-claim-languages')).toHaveTextContent(/English/i);
    expect(within(band).getByTestId('landing-claim-languages')).toHaveTextContent(/Deutsch/i);
    expect(within(band).getByTestId('landing-claim-languages')).toHaveTextContent(/Ελληνικά/i);
  });

  it('the agent claim carries a reach to the public connect surface', () => {
    renderLanding();
    const reach = screen.getByTestId('landing-claim-agents-reach');
    expect(reach).toHaveAttribute('href', '/connect');
  });

  it('stages statement, guest act, then claims in arrival order', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          makeConfigResponse('window.__MIKROULI_CONFIG__ = { guestShortenEnabled: true };\n'),
        ),
    );
    renderLanding();
    await waitFor(() => expect(screen.getByTestId('guest-shorten-section')).toBeInTheDocument());
    const ids = renderedSectionIds();
    const statementIdx = ids.indexOf('landing-statement');
    const actIdx = ids.indexOf('guest-shorten-section');
    const claimsIdx = ids.indexOf('landing-claims');
    expect(statementIdx).toBeGreaterThanOrEqual(0);
    expect(actIdx).toBeGreaterThan(statementIdx);
    expect(claimsIdx).toBeGreaterThan(actIdx);
  });

  it('stands complete without the guest act: statement and claims remain', () => {
    renderLanding();
    expect(screen.queryByTestId('guest-shorten-section')).not.toBeInTheDocument();
    expect(screen.getByTestId('landing-statement')).toBeInTheDocument();
    expect(screen.getByTestId('landing-claims')).toBeInTheDocument();
  });

  it('retires the superseded sections and inline hero CTAs', () => {
    renderLanding();
    expect(screen.queryByTestId('landing-bottom-cta')).not.toBeInTheDocument();
    expect(screen.queryByTestId('landing-feature-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('agent-section')).not.toBeInTheDocument();
    // The register and sign-in reaches live in the shell band, not the page.
    expect(screen.queryByTestId('landing-cta-register')).not.toBeInTheDocument();
    expect(screen.queryByTestId('landing-cta-login')).not.toBeInTheDocument();
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
      renderLanding();
      await waitFor(() => expect(screen.getByTestId('guest-shorten-section')).toBeInTheDocument());
      expect(screen.getByTestId('shorten-url')).toBeInTheDocument();
      // The register nudge is hidden until a Guest shorten succeeds.
      expect(screen.queryByTestId('guest-nudge')).not.toBeInTheDocument();
    });

    it('after a successful shorten, the nudge names the account additions and reaches register', async () => {
      const newLink = {
        shortUrl: 'abc123',
        originalUrl: 'http://long.com',
        createdAt: '2026-01-01T00:00:00Z',
        expiresAt: null,
      };
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(
            makeConfigResponse('window.__MIKROULI_CONFIG__ = { guestShortenEnabled: true };\n'),
          )
          .mockResolvedValueOnce({ ok: true, status: 201, json: () => Promise.resolve(newLink) }),
      );
      renderLanding();
      await waitFor(() => expect(screen.getByTestId('shorten-url')).toBeInTheDocument());
      fireEvent.change(screen.getByTestId('shorten-url'), {
        target: { value: 'http://long.com' },
      });
      fireEvent.click(screen.getByTestId('shorten-submit'));
      await waitFor(() => expect(screen.getByTestId('guest-nudge')).toBeInTheDocument());
      expect(screen.getByTestId('guest-nudge-feature-kept-link')).toBeInTheDocument();
      expect(screen.getByTestId('guest-nudge-feature-dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('guest-nudge-feature-api-keys')).toBeInTheDocument();
      expect(screen.getByTestId('guest-nudge-cta')).toHaveAttribute('href', '/register');
    });
  });
});
