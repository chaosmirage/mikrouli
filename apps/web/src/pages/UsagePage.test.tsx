import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TestQueryClientProvider } from '../test/queryClient';
import { AuthContext } from '../auth/AuthContext';
import type { AuthContextValue } from '../auth/AuthContext';
import UsagePage from './UsagePage';
import * as client from '../api/client';
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

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('renders the reset date', async () => {
    renderUsagePage();
    await waitFor(() => expect(screen.getByTestId('usage-page')).toBeInTheDocument());
    expect(screen.getByTestId('reset-date')).toBeInTheDocument();
  });

  it('renders the retention period', async () => {
    renderUsagePage();
    await waitFor(() => expect(screen.getByTestId('usage-page')).toBeInTheDocument());
    expect(screen.getByTestId('retention-info')).toBeInTheDocument();
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

  it('shows an error alert when the api call fails', async () => {
    vi.spyOn(client, 'apiFetch').mockRejectedValue(new client.ApiError(401, 'Unauthorized'));
    renderUsagePage();
    await waitFor(() => expect(screen.getByTestId('usage-error')).toBeInTheDocument());
  });
});
