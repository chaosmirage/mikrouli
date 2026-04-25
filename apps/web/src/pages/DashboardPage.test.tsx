import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';

function makeResponse(data: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(data) };
}

function renderDashboard() {
  render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse([])));
});

describe('DashboardPage', () => {
  it('renders the shorten URL form', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByTestId('shorten-url')).toBeInTheDocument());
    expect(screen.getByTestId('shorten-submit')).toBeInTheDocument();
  });

  it('after shortening shows new link alert and table row', async () => {
    const newLink = {
      shortUrl: 'http://s.io/abc',
      originalUrl: 'http://long.com',
      createdAt: '2024-01-01T00:00:00Z',
      expiresAt: null,
    };
    const mockFetch = vi.fn();
    mockFetch.mockResolvedValueOnce(makeResponse([]));
    mockFetch.mockResolvedValueOnce(makeResponse(newLink));
    mockFetch.mockResolvedValueOnce(makeResponse([newLink]));
    vi.stubGlobal('fetch', mockFetch);
    renderDashboard();
    await waitFor(() => expect(screen.getByTestId('shorten-url')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('shorten-url'), { target: { value: 'http://long.com' } });
    fireEvent.click(screen.getByTestId('shorten-submit'));
    await waitFor(() => expect(screen.getByTestId('new-link-alert')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('link-row-http://s.io/abc')).toBeInTheDocument());
  });

  it('copy button is present on new link alert', async () => {
    const newLink = {
      shortUrl: 'http://s.io/xyz',
      originalUrl: 'http://original.com',
      createdAt: '2024-01-01T00:00:00Z',
      expiresAt: null,
    };
    const mockFetch = vi.fn();
    mockFetch.mockResolvedValueOnce(makeResponse([]));
    mockFetch.mockResolvedValueOnce(makeResponse(newLink));
    mockFetch.mockResolvedValueOnce(makeResponse([newLink]));
    vi.stubGlobal('fetch', mockFetch);
    renderDashboard();
    await waitFor(() => expect(screen.getByTestId('shorten-url')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('shorten-url'), {
      target: { value: 'http://original.com' },
    });
    fireEvent.click(screen.getByTestId('shorten-submit'));
    await waitFor(() => expect(screen.getByTestId('copy-link')).toBeInTheDocument());
  });

  it('shows loading indicator while fetching links', async () => {
    let resolve: (v: unknown) => void = () => undefined;
    const pending = new Promise((r) => {
      resolve = r;
    });
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending.then(() => makeResponse([]))));
    renderDashboard();
    expect(screen.getByTestId('dashboard-loading')).toBeInTheDocument();
    resolve(undefined);
    await waitFor(() => expect(screen.queryByTestId('dashboard-loading')).not.toBeInTheDocument());
  });
});
