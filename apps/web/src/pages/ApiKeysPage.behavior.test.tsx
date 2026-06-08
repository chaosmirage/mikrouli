// Pins the observable behavior of ApiKeysPage: a REVOKE failure is silently ignored
// (no error shown; dialog closes; list refreshes); the empty-list render; the
// fetch-error render.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ApiKeysPage from './ApiKeysPage';

function makeOk(data: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(data) };
}
function makeErr(status: number, body: unknown) {
  return { ok: false, status, json: () => Promise.resolve(body) };
}

function renderApiKeys() {
  render(
    <MemoryRouter>
      <ApiKeysPage />
    </MemoryRouter>,
  );
}

const ACTIVE_KEY = {
  id: 'k1',
  label: 'my-key',
  keyPrefix: 'key_sec',
  createdAt: '2024-01-01T00:00:00Z',
  lastUsedAt: null,
  revokedAt: null,
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeOk({ data: [] })));
});

describe('ApiKeysPage', () => {
  it('pins revoke failure is SILENTLY IGNORED (no error shown, dialog closes, list refreshes)', async () => {
    const mockFetch = vi.fn();
    mockFetch.mockResolvedValueOnce(makeOk({ data: [ACTIVE_KEY] })); // initial load
    mockFetch.mockResolvedValueOnce(makeErr(500, { detail: 'revoke failed boom' })); // DELETE revoke
    mockFetch.mockResolvedValueOnce(makeOk({ data: [ACTIVE_KEY] })); // refresh reload
    vi.stubGlobal('fetch', mockFetch);

    renderApiKeys();
    await waitFor(() => expect(screen.getByTestId('revoke-k1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('revoke-k1'));
    await waitFor(() => expect(screen.getByTestId('revoke-confirm')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('revoke-confirm'));

    // List refreshes (third fetch fired) and the dialog closes.
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.queryByTestId('revoke-confirm')).not.toBeInTheDocument());

    // The revoke failure is swallowed: no error message anywhere, no error text rendered.
    expect(screen.queryByTestId('key-create-error')).not.toBeInTheDocument();
    expect(screen.queryByText('revoke failed boom')).not.toBeInTheDocument();
    // Table still rendered after refresh.
    expect(screen.getByTestId('api-keys-table')).toBeInTheDocument();
  });

  it('pins empty-list render (no-keys-message)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeOk({ data: [] })));
    renderApiKeys();
    await waitFor(() => expect(screen.getByTestId('no-keys-message')).toBeInTheDocument());
    expect(screen.queryByTestId('api-keys-table')).not.toBeInTheDocument();
  });

  it('pins fetch-error render (error message shown, no table, no empty message)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeErr(500, { detail: 'keys load boom' })));
    renderApiKeys();
    await waitFor(() => expect(screen.getByText('keys load boom')).toBeInTheDocument());
    expect(screen.queryByTestId('api-keys-table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('no-keys-message')).not.toBeInTheDocument();
  });
});
