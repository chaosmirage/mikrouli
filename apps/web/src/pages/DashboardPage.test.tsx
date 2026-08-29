import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TestQueryClientProvider } from '../test/queryClient';
import DashboardPage from './DashboardPage';

function makeResponse(data: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(data) };
}

// A refused response: apiFetch reads the content-type header to decide
// whether the body carries problem-details.
function makeRefusal(detail: string) {
  return {
    ok: false,
    status: 422,
    json: () => Promise.resolve({ detail }),
    headers: { get: () => 'application/problem+json' },
  };
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

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ data: [] })));
});

describe('DashboardPage', () => {
  it('renders the shorten URL form', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByTestId('shorten-url')).toBeInTheDocument());
    expect(screen.getByTestId('shorten-submit')).toBeInTheDocument();
  });

  it('after shortening the new link stands as a row in the set', async () => {
    const newLink = {
      shortUrl: 'http://s.io/abc',
      originalUrl: 'http://long.com',
      createdAt: '2024-01-01T00:00:00Z',
      expiresAt: null,
    };
    const mockFetch = vi.fn();
    mockFetch.mockResolvedValueOnce(makeResponse({ data: [] }));
    mockFetch.mockResolvedValueOnce(makeResponse(newLink));
    mockFetch.mockResolvedValueOnce(makeResponse({ data: [newLink] }));
    vi.stubGlobal('fetch', mockFetch);
    renderDashboard();
    await waitFor(() => expect(screen.getByTestId('shorten-url')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('shorten-url'), { target: { value: 'http://long.com' } });
    fireEvent.click(screen.getByTestId('shorten-submit'));
    await waitFor(() => expect(screen.getByTestId('link-row-abc')).toBeInTheDocument());
    expect(screen.getByTestId('link-row-abc')).toHaveTextContent('http://long.com');
  });

  it('shows loading indicator while fetching links', async () => {
    let resolve: (v: unknown) => void = () => undefined;
    const pending = new Promise((r) => {
      resolve = r;
    });
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending.then(() => makeResponse({ data: [] }))));
    renderDashboard();
    expect(screen.getByTestId('dashboard-loading')).toBeInTheDocument();
    resolve(undefined);
    await waitFor(() => expect(screen.queryByTestId('dashboard-loading')).not.toBeInTheDocument());
  });

  it('renders created and expiry standings in the locale date convention', async () => {
    const link = {
      shortUrl: 'abc',
      originalUrl: 'http://long.com',
      createdAt: '2024-01-01T00:00:00Z',
      expiresAt: '2025-02-05T00:00:00Z',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ data: [link] })));
    renderDashboard();
    await waitFor(() => expect(screen.getByTestId('link-row-abc')).toBeInTheDocument());
    expect(screen.getByTestId('created-abc')).toHaveTextContent('Jan 1, 2024');
    expect(screen.getByTestId('expires-abc')).toHaveTextContent('Feb 5, 2025');
  });

  describe('narrowing', () => {
    const LINKS = [
      {
        shortUrl: 'abc',
        originalUrl: 'http://long.com',
        createdAt: '2024-01-01T00:00:00Z',
        expiresAt: null,
      },
      {
        shortUrl: 'xyz',
        originalUrl: 'http://other.example',
        createdAt: '2024-01-02T00:00:00Z',
        expiresAt: null,
      },
    ];

    it('narrows the set live as a fragment is entered, without a submit', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ data: LINKS })));
      renderDashboard();
      await waitFor(() => expect(screen.getByTestId('link-row-abc')).toBeInTheDocument());
      expect(screen.getByTestId('link-row-xyz')).toBeInTheDocument();

      fireEvent.change(screen.getByTestId('narrow-links'), { target: { value: 'LONG' } });

      expect(screen.getByTestId('link-row-abc')).toBeInTheDocument();
      expect(screen.queryByTestId('link-row-xyz')).not.toBeInTheDocument();
    });

    it('narrows on a slug fragment too', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ data: LINKS })));
      renderDashboard();
      await waitFor(() => expect(screen.getByTestId('link-row-abc')).toBeInTheDocument());

      fireEvent.change(screen.getByTestId('narrow-links'), { target: { value: 'xyz' } });

      expect(screen.queryByTestId('link-row-abc')).not.toBeInTheDocument();
      expect(screen.getByTestId('link-row-xyz')).toBeInTheDocument();
    });

    it('states the honest empty when the fragment matches nothing', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ data: LINKS })));
      renderDashboard();
      await waitFor(() => expect(screen.getByTestId('link-row-abc')).toBeInTheDocument());

      fireEvent.change(screen.getByTestId('narrow-links'), { target: { value: 'nomatch' } });

      expect(screen.getByTestId('narrowed-empty')).toBeInTheDocument();
      expect(screen.getByTestId('narrowed-empty')).toHaveTextContent('nomatch');
    });

    it('restores the whole set when the fragment is cleared', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ data: LINKS })));
      renderDashboard();
      await waitFor(() => expect(screen.getByTestId('link-row-abc')).toBeInTheDocument());
      fireEvent.change(screen.getByTestId('narrow-links'), { target: { value: 'long' } });
      expect(screen.queryByTestId('link-row-xyz')).not.toBeInTheDocument();

      fireEvent.change(screen.getByTestId('narrow-links'), { target: { value: '' } });

      expect(screen.getByTestId('link-row-abc')).toBeInTheDocument();
      expect(screen.getByTestId('link-row-xyz')).toBeInTheDocument();
      expect(screen.queryByTestId('narrowed-empty')).not.toBeInTheDocument();
    });
  });

  describe('in-row destination correction', () => {
    const LINK = {
      shortUrl: 'abc',
      originalUrl: 'http://long.com',
      createdAt: '2024-01-01T00:00:00Z',
      expiresAt: null,
    };

    it('opens on the standing destination inside the row, with no dialog', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ data: [LINK] })));
      renderDashboard();
      await waitFor(() => expect(screen.getByTestId('link-row-abc')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('edit-abc'));

      const input = screen.getByTestId('edit-url-input-abc');
      expect(input).toHaveValue('http://long.com');
      expect(screen.queryByTestId('edit-dialog')).not.toBeInTheDocument();
    });

    it('confirms the correction in place and the row carries the new destination', async () => {
      const updatedLink = { ...LINK, originalUrl: 'http://new-destination.com' };
      const mockFetch = vi.fn();
      mockFetch.mockResolvedValueOnce(makeResponse({ data: [LINK] })); // initial load
      mockFetch.mockResolvedValueOnce(makeResponse(updatedLink)); // PATCH
      mockFetch.mockResolvedValueOnce(makeResponse({ data: [updatedLink] })); // refetch
      vi.stubGlobal('fetch', mockFetch);
      renderDashboard();
      await waitFor(() => expect(screen.getByTestId('link-row-abc')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('edit-abc'));
      fireEvent.change(screen.getByTestId('edit-url-input-abc'), {
        target: { value: 'http://new-destination.com' },
      });
      fireEvent.click(screen.getByTestId('edit-confirm-abc'));

      await waitFor(() =>
        expect(screen.getByTestId('link-row-abc')).toHaveTextContent('http://new-destination.com'),
      );
      expect(screen.queryByTestId('edit-url-input-abc')).not.toBeInTheDocument();
    });

    it('states a refused destination in place and keeps the correction open', async () => {
      const mockFetch = vi.fn();
      mockFetch.mockResolvedValueOnce(makeResponse({ data: [LINK] })); // initial load
      mockFetch.mockResolvedValueOnce(makeRefusal('url must be a public http(s) URL')); // PATCH refused
      vi.stubGlobal('fetch', mockFetch);
      renderDashboard();
      await waitFor(() => expect(screen.getByTestId('link-row-abc')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('edit-abc'));
      fireEvent.change(screen.getByTestId('edit-url-input-abc'), {
        target: { value: 'http://denied.example' },
      });
      fireEvent.click(screen.getByTestId('edit-confirm-abc'));

      await waitFor(() => expect(screen.getByTestId('edit-error-abc')).toBeInTheDocument());
      expect(screen.getByTestId('edit-error-abc')).toHaveTextContent(
        'url must be a public http(s) URL',
      );
      // The draft survives so the owner can correct and confirm again.
      expect(screen.getByTestId('edit-url-input-abc')).toHaveValue('http://denied.example');
      // The previous destination still stands in the link's data until a
      // confirmed correction replaces it.
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('cancel closes the correction leaving the row as it stood', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ data: [LINK] })));
      renderDashboard();
      await waitFor(() => expect(screen.getByTestId('link-row-abc')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('edit-abc'));
      fireEvent.click(screen.getByTestId('edit-cancel-abc'));

      expect(screen.queryByTestId('edit-url-input-abc')).not.toBeInTheDocument();
      expect(screen.getByTestId('link-row-abc')).toHaveTextContent('http://long.com');
    });
  });
});
