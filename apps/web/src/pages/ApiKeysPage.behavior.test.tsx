// Observable behavior of ApiKeysPage: a retire failure is silently ignored
// (no error shown; the list refreshes); the review rows carry the locale's own
// date conventions and the never-used standing; the empty-list and fetch-error
// renders.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TestQueryClientProvider } from '../test/queryClient';
import ApiKeysPage from './ApiKeysPage';

function makeHeaders() {
  return { get: () => null };
}
function makeOk(data: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(data), headers: makeHeaders() };
}
function makeErr(status: number, body: unknown) {
  return { ok: false, status, json: () => Promise.resolve(body), headers: makeHeaders() };
}

function renderApiKeys() {
  render(
    <MemoryRouter>
      <TestQueryClientProvider>
        <ApiKeysPage />
      </TestQueryClientProvider>
    </MemoryRouter>,
  );
}

const ACTIVE_KEY = {
  id: 'k1',
  label: 'my-key',
  keyPrefix: 'mk_a1b2',
  createdAt: '2024-01-01T00:00:00Z',
  lastUsedAt: null,
  revokedAt: null,
};

const USED_KEY = {
  ...ACTIVE_KEY,
  id: 'k2',
  label: 'used-key',
  lastUsedAt: '2024-06-15T12:30:00Z',
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeOk({ data: [] })));
});

describe('ApiKeysPage', () => {
  it('ignores a retire failure silently: no error statement, list still refreshes', async () => {
    const mockFetch = vi.fn();
    mockFetch.mockResolvedValueOnce(makeOk({ data: [ACTIVE_KEY] })); // initial load
    mockFetch.mockResolvedValueOnce(makeErr(500, { detail: 'revoke failed boom' })); // DELETE revoke
    mockFetch.mockResolvedValueOnce(makeOk({ data: [ACTIVE_KEY] })); // refresh reload
    vi.stubGlobal('fetch', mockFetch);

    renderApiKeys();
    await waitFor(() => expect(screen.getByTestId('revoke-k1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('revoke-k1'));

    // List refreshes (third fetch fired) and no error statement stands.
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3));
    expect(screen.queryByText('revoke failed boom')).not.toBeInTheDocument();
    expect(screen.getByTestId('api-keys-table')).toBeInTheDocument();
  });

  it('renders the review rows with locale-convention dates and the never-used standing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeOk({ data: [ACTIVE_KEY, USED_KEY] })),
    );
    renderApiKeys();
    await waitFor(() => expect(screen.getByTestId('api-keys-table')).toBeInTheDocument());
    // Dates read in the active locale's convention, not as raw ISO slices.
    // Both credentials were created on the same day, so the date stands twice.
    expect(screen.getAllByText('Jan 1, 2024').length).toBe(2);
    expect(screen.getByText('Jun 15, 2024')).toBeInTheDocument();
    // A credential never used says exactly that.
    expect(screen.getAllByText('Never used').length).toBeGreaterThan(0);
  });

  it('renders the honest empty (no review list, empty statement stands)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeOk({ data: [] })));
    renderApiKeys();
    await waitFor(() => expect(screen.getByText('No API keys yet')).toBeInTheDocument());
    expect(screen.queryByTestId('api-keys-table')).not.toBeInTheDocument();
  });

  it('states the list failure as a resolved statement (no review list, no empty statement)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeErr(500, { detail: 'keys load boom' })),
    );
    renderApiKeys();
    await waitFor(() => expect(screen.getByText('keys load boom')).toBeInTheDocument());
    expect(screen.queryByTestId('api-keys-table')).not.toBeInTheDocument();
    expect(screen.queryByText('No API keys yet')).not.toBeInTheDocument();
  });
});
