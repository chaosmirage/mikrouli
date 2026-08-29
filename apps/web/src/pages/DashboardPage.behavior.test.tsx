// Pins the observable behavior of DashboardPage: a DELETE failure surfaces in the
// shorten error slot (current routing); the empty-list render; the fetch-error render.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TestQueryClientProvider } from '../test/queryClient';
import DashboardPage from './DashboardPage';

function makeHeaders() {
  return { get: () => null };
}
function makeOk(data: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(data), headers: makeHeaders() };
}
function makeErr(status: number, body: unknown) {
  return { ok: false, status, json: () => Promise.resolve(body), headers: makeHeaders() };
}

function renderDashboard() {
  render(
    <MemoryRouter>
      <TestQueryClientProvider>
        <DashboardPage />
      </TestQueryClientProvider>
    </MemoryRouter>,
  );
}

const LINK = {
  shortUrl: 'http://s.io/abc',
  originalUrl: 'http://long.com',
  createdAt: '2024-01-01T00:00:00Z',
  expiresAt: null,
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeOk({ data: [] })));
});

describe('DashboardPage', () => {
  it('pins delete failure surfaces in the links-table error slot', async () => {
    const mockFetch = vi.fn();
    mockFetch.mockResolvedValueOnce(makeOk({ data: [LINK] })); // initial load
    mockFetch.mockResolvedValueOnce(makeErr(500, { detail: 'delete failed boom' })); // DELETE
    vi.stubGlobal('fetch', mockFetch);

    renderDashboard();
    await waitFor(() => expect(screen.getByTestId('link-row-abc')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('delete-abc'));
    await waitFor(() => expect(screen.getByTestId('delete-confirm')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('delete-confirm'));

    // The delete error lands in the links-table error slot.
    await waitFor(() => expect(screen.getByTestId('links-table-error')).toBeInTheDocument());
    expect(screen.getByTestId('links-table-error')).toHaveTextContent('delete failed boom');
  });

  it('pins empty-list render (no-links-message)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeOk({ data: [] })));
    renderDashboard();
    await waitFor(() => expect(screen.getByTestId('no-links-message')).toBeInTheDocument());
    expect(screen.queryByTestId('dashboard-links-set')).not.toBeInTheDocument();
  });

  it('pins fetch-error render (error message shown, no set, no empty message)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeErr(500, { detail: 'load failed boom' })));
    renderDashboard();
    await waitFor(() => expect(screen.getByText('load failed boom')).toBeInTheDocument());
    expect(screen.queryByTestId('dashboard-links-set')).not.toBeInTheDocument();
    expect(screen.queryByTestId('no-links-message')).not.toBeInTheDocument();
  });
});
