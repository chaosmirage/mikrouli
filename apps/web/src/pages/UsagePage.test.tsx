import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TestQueryClientProvider } from '../test/queryClient';
import { AuthContext } from '../auth/AuthContext';
import type { AuthContextValue } from '../auth/AuthContext';
import i18next from '../i18n';
import UsagePage from './UsagePage';
import * as client from '../api/client';
import { ApiError } from '../api/client';
import type { UsageSummary } from '../api/types';

const mockAuth: AuthContextValue = {
  user: { id: 'u1', email: 'test@example.com', createdAt: '2026-01-01T00:00:00.000Z' },
  bootstrapping: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  loginWithGithub: vi.fn(),
};

const USAGE_FIXTURE: UsageSummary = {
  linksCreated: 12,
  linkLimit: 100,
  linksRemaining: 88,
  keysCreated: 3,
  keyLimit: 10,
  keysRemaining: 7,
  resetDate: '2026-07-01T00:00:00.000Z',
  retentionMs: 94_608_000_000,
};

function renderUsagePage() {
  render(
    <TestQueryClientProvider>
      <MemoryRouter>
        <AuthContext.Provider value={mockAuth}>
          <UsagePage />
        </AuthContext.Provider>
      </MemoryRouter>
    </TestQueryClientProvider>,
  );
}

describe('UsagePage', () => {
  beforeEach(() => {
    vi.spyOn(client, 'apiFetch').mockResolvedValue(USAGE_FIXTURE);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await act(async () => {
      await i18next.changeLanguage('en');
    });
  });

  it('names the surface with a heading and one capability line', async () => {
    renderUsagePage();
    await waitFor(() => expect(screen.getByTestId('usage-page')).toBeInTheDocument());
    expect(screen.getByRole('heading', { level: 1, name: 'Usage' })).toBeInTheDocument();
    expect(
      screen.getByText(/monthly standing against its link and key limits/i),
    ).toBeInTheDocument();
  });

  it('renders the usage page with link quota information', async () => {
    renderUsagePage();
    await waitFor(() => expect(screen.getByTestId('usage-page')).toBeInTheDocument());
    expect(screen.getByTestId('links-quota-card')).toBeInTheDocument();
  });

  it('renders the key quota card', async () => {
    renderUsagePage();
    await waitFor(() => expect(screen.getByTestId('usage-page')).toBeInTheDocument());
    expect(screen.getByTestId('keys-quota-card')).toBeInTheDocument();
  });

  it('shows linksCreated and linksRemaining from the response', async () => {
    renderUsagePage();
    await waitFor(() => expect(screen.getByTestId('usage-page')).toBeInTheDocument());
    expect(screen.getByTestId('links-created')).toHaveTextContent('12');
    expect(screen.getByTestId('links-remaining')).toHaveTextContent('88');
  });

  it('shows keysCreated and keysRemaining from the response', async () => {
    renderUsagePage();
    await waitFor(() => expect(screen.getByTestId('usage-page')).toBeInTheDocument());
    expect(screen.getByTestId('keys-created')).toHaveTextContent('3');
    expect(screen.getByTestId('keys-remaining')).toHaveTextContent('7');
  });

  it('renders a determinate progress bar for each quota with the used percentage', async () => {
    renderUsagePage();
    await waitFor(() => expect(screen.getByTestId('usage-page')).toBeInTheDocument());
    const linksBar = screen.getByTestId('links-quota-card-progress');
    const keysBar = screen.getByTestId('keys-quota-card-progress');
    // 12 / 100 = 12%, 3 / 10 = 30%
    expect(linksBar).toHaveAttribute('aria-valuenow', '12');
    expect(keysBar).toHaveAttribute('aria-valuenow', '30');
  });

  it('renders a full, error-colored progress bar when the allowance is exhausted', async () => {
    vi.spyOn(client, 'apiFetch').mockResolvedValue({
      ...USAGE_FIXTURE,
      linksCreated: 100,
      linksRemaining: 0,
    });
    renderUsagePage();
    await waitFor(() => expect(screen.getByTestId('usage-page')).toBeInTheDocument());
    const linksBar = screen.getByTestId('links-quota-card-progress');
    expect(linksBar).toHaveAttribute('aria-valuenow', '100');
    expect(linksBar.className).toMatch(/colorError/);
  });

  it('states the exhausted standing as resolved matter beside its fill proportion', async () => {
    vi.spyOn(client, 'apiFetch').mockResolvedValue({
      ...USAGE_FIXTURE,
      linksCreated: 100,
      linksRemaining: 0,
    });
    renderUsagePage();
    await waitFor(() => expect(screen.getByTestId('usage-page')).toBeInTheDocument());
    const exhausted = screen.getByTestId('links-quota-card-exhausted');
    expect(exhausted).toHaveTextContent('You have reached your monthly short-link limit.');
    // A standing with room left states no exhaustion.
    expect(screen.queryByTestId('keys-quota-card-exhausted')).not.toBeInTheDocument();
  });

  it('renders the reset date in the locale convention', async () => {
    renderUsagePage();
    await waitFor(() => expect(screen.getByTestId('reset-date')).toBeInTheDocument());
    expect(screen.getByTestId('reset-date')).toHaveTextContent('Jul 1, 2026');
  });

  it('keeps both quota rows on one shared bounded track template so their standings compare', async () => {
    renderUsagePage();
    await waitFor(() => expect(screen.getByTestId('links-quota-card-row')).toBeInTheDocument());

    // The two quota cards' rows adopt the SAME row style: their
    // created/limit/remaining standings stand on one shared template, so
    // like-positioned figures compare at the same x in both cards.
    const linksRow = screen.getByTestId('links-quota-card-row');
    const keysRow = screen.getByTestId('keys-quota-card-row');
    expect(linksRow.className).toBe(keysRow.className);

    // The shared template: every track bounded (fr with a zero floor), so a
    // long label folds inside its own track instead of pushing another
    // standing — and the subgrid adoption that carries the template into
    // each row.
    const styles = Array.from(document.querySelectorAll('style'))
      .map((sheet) => sheet.textContent ?? '')
      .join('');
    expect(styles).toContain('minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)');
    expect(styles).toContain('grid-template-columns:subgrid');
  });

  it('renders the retention period in the active locale', async () => {
    await act(async () => {
      await i18next.changeLanguage('de');
    });
    renderUsagePage();
    await waitFor(() => expect(screen.getByTestId('retention-info')).toBeInTheDocument());
    expect(screen.getByTestId('retention-info')).toHaveTextContent('3 Jahre');
  });

  it('renders a contact support button linking to mailto:support@mikrou.li', async () => {
    renderUsagePage();
    await waitFor(() => expect(screen.getByTestId('usage-page')).toBeInTheDocument());
    const btn = screen.getByTestId('request-more-btn');
    expect(btn).toBeInTheDocument();
    // Button should trigger a mailto link to support
    const anchor = btn.closest('a') ?? btn.querySelector('a') ?? btn;
    const href = anchor.getAttribute('href') ?? '';
    expect(href).toContain('support@mikrou.li');
  });

  it('shows a loading spinner while the query is in flight', () => {
    // Never resolves
    vi.spyOn(client, 'apiFetch').mockReturnValue(new Promise(() => {}));
    renderUsagePage();
    expect(screen.getByTestId('usage-loading')).toBeInTheDocument();
  });

  it('states the failure as the resolved problem-details message', async () => {
    vi.spyOn(client, 'apiFetch').mockRejectedValue(new ApiError(500, 'usage load failed'));
    renderUsagePage();
    await waitFor(() => expect(screen.getByText('usage load failed')).toBeInTheDocument());
    // The exhausted-standing wording is reserved for an exhausted allowance,
    // never for a failed load.
    expect(
      screen.queryByText('You have reached your monthly short-link limit.'),
    ).not.toBeInTheDocument();
  });
});
