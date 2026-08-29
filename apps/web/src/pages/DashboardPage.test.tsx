import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { TestQueryClientProvider } from '../test/queryClient';
import DashboardPage from './DashboardPage';
import { createAppTheme } from '../theme';

const LIGHT_THEME = createAppTheme('light');

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
    <ThemeProvider theme={LIGHT_THEME}>
      <MemoryRouter>
        <TestQueryClientProvider>
          <DashboardPage />
        </TestQueryClientProvider>
      </MemoryRouter>
    </ThemeProvider>,
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

    it('stands closed by default and opens only on the row edit reach', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ data: [LINK] })));
      renderDashboard();
      await waitFor(() => expect(screen.getByTestId('link-row-abc')).toBeInTheDocument());

      // No editor is mounted anywhere in the set on load: the destination
      // stands as text until the row's own edit reach opens it.
      expect(screen.queryByTestId('edit-url-input-abc')).not.toBeInTheDocument();
      expect(screen.getByTestId('link-row-abc')).toHaveTextContent('http://long.com');

      fireEvent.click(screen.getByTestId('edit-abc'));

      expect(screen.getByTestId('edit-url-input-abc')).toBeInTheDocument();
    });

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

    it('labels the entering once: the standing caption names it, the input carries the accessible name', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ data: [LINK] })));
      renderDashboard();
      await waitFor(() => expect(screen.getByTestId('link-row-abc')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('edit-abc'));

      const input = screen.getByTestId('edit-url-input-abc');
      // ONE visible label: the standing's caption. The entering adds no
      // second one — its TextField renders no InputLabel of its own.
      const control = input.closest('div.MuiFormControl-root');
      expect(control?.querySelector('label')).toBeNull();
      expect(screen.getByTestId('link-row-abc')).toHaveTextContent('Original URL');
      // The accessible name survives the dedupe, carried by the input.
      expect(input).toHaveAttribute('aria-label', 'Destination');
    });

    it('separates the caption from the entering with ladder rhythm', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ data: [LINK] })));
      renderDashboard();
      await waitFor(() => expect(screen.getByTestId('link-row-abc')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('edit-abc'));

      expect(screen.getByTestId('edit-correction-abc')).toHaveStyle({ marginTop: '8px' });
    });

    it('keeps an open editor and its draft across viewport changes', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ data: [LINK] })));
      renderDashboard();
      await waitFor(() => expect(screen.getByTestId('link-row-abc')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('edit-abc'));
      fireEvent.change(screen.getByTestId('edit-url-input-abc'), {
        target: { value: 'http://edited.example' },
      });

      // The correction state lives at the page, not the row: a viewport
      // change crosses the responsive switch (pure CSS in these rows) and
      // must never remount the editor away.
      fireEvent(window, new Event('resize'));

      const input = screen.getByTestId('edit-url-input-abc');
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue('http://edited.example');
    });
  });

  describe('long destinations stay inside the row', () => {
    const LONG_URL = `http://long.example/${'a'.repeat(320)}`;
    const LONG_LINK = {
      shortUrl: 'abc',
      originalUrl: LONG_URL,
      createdAt: '2024-01-01T00:00:00Z',
      expiresAt: null,
    };

    it('wraps the destination text instead of overflowing the row', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ data: [LONG_LINK] })));
      renderDashboard();
      await waitFor(() => expect(screen.getByTestId('link-row-abc')).toBeInTheDocument());

      // The wrap-anywhere rule is what engages the flex min-width chain, so
      // a spaceless URL folds inside its standing instead of widening it.
      expect(screen.getByText(LONG_URL)).toHaveStyle({ overflowWrap: 'anywhere' });
    });

    it('constrains the in-row editor to the row width: the entering fills the line it is given', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ data: [LONG_LINK] })));
      renderDashboard();
      await waitFor(() => expect(screen.getByTestId('link-row-abc')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('edit-abc'));

      const entering = screen
        .getByTestId('edit-url-input-abc')
        .closest('div.MuiFormControl-root');
      expect(entering).not.toBeNull();
      // fullWidth + flex basis + min-width 0: the entering carries no fixed px
      // width, fills the line it is given, and shrinks with the row — so a
      // long value can neither expand nor overflow the container.
      expect(entering).toHaveClass('MuiFormControl-fullWidth');
      expect(entering).toHaveStyle({ flex: '1 1 240px' });
      expect(entering).toHaveStyle({ minWidth: '0' });
    });
  });

  describe("the row's act reaches stand as one cluster", () => {
    const LINK = {
      shortUrl: 'abc',
      originalUrl: 'http://long.com',
      createdAt: '2024-01-01T00:00:00Z',
      expiresAt: null,
    };

    // jsdom lays nothing out, so the cluster's order and membership are read
    // from the DOM: the act cluster is the parent the edit reach stands in.
    function readCluster() {
      const acts = screen.getByTestId('edit-abc').parentElement;
      return { acts, members: Array.from(acts?.children ?? []) };
    }

    it('stands the copy reach immediately beside the stats, edit, and retire reaches', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ data: [LINK] })));
      renderDashboard();
      await waitFor(() => expect(screen.getByTestId('link-row-abc')).toBeInTheDocument());

      // The four reaches and nothing else stand in the row's act cluster, in
      // this order — the copy reach directly beside its siblings.
      const copy = screen.getByTestId('copy-abc');
      const stats = screen.getByTestId('stats-abc');
      const edit = screen.getByTestId('edit-abc');
      const retire = screen.getByTestId('delete-abc');
      const { members } = readCluster();
      expect(members).toEqual([copy.parentElement, stats, edit, retire]);

      // The copy reach contributes ONLY its button to the cluster's flow: no
      // reserved statement matter rides beside or under the icon, so the
      // cluster reads as one tight group with a single shared gap.
      expect(copy.parentElement?.childElementCount).toBe(1);
      expect(copy.parentElement?.textContent).toBe('');
    });

    it('keeps the cluster untouched when a take lands: the confirmation floats over it', async () => {
      const taken: string[] = [];
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: (text: string) => (taken.push(text), Promise.resolve()) },
      });
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ data: [LINK] })));
      renderDashboard();
      await waitFor(() => expect(screen.getByTestId('link-row-abc')).toBeInTheDocument());

      const { acts, members } = readCluster();
      fireEvent.click(screen.getByTestId('copy-abc'));

      const landed = await screen.findByTestId('copy-abc-landed');
      // The landing joins nothing: the cluster's membership and order are
      // bit-identical, and the confirmation stands absolute — out of the
      // row's flow entirely, so nothing in the row shifts on the take.
      expect(Array.from(acts?.children ?? [])).toEqual(members);
      expect(getComputedStyle(landed).position).toBe('absolute');
      expect(taken).toHaveLength(1);
    });
  });

  describe('the set owns its box rhythm', () => {
    const LINKS = [
      {
        shortUrl: 'http://s.io/abc',
        originalUrl: 'http://long.com',
        createdAt: '2024-01-01T00:00:00Z',
        expiresAt: null,
      },
      {
        shortUrl: 'http://s.io/xyz',
        originalUrl: 'http://other.example/with/a/much/longer/destination/path',
        createdAt: '2024-01-02T00:00:00Z',
        expiresAt: '2025-02-05T00:00:00Z',
      },
    ];

    it('insets the rows from the set edges, full set and narrowed set alike', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ data: LINKS })));
      renderDashboard();
      await waitFor(() => expect(screen.getByTestId('link-row-abc')).toBeInTheDocument());

      const rows = screen.getByTestId('dashboard-links-rows');
      expect(rows).toHaveStyle({ paddingLeft: '16px' });
      expect(rows).toHaveStyle({ paddingRight: '16px' });
      expect(rows).toHaveStyle({ paddingBottom: '16px' });

      // The narrowing motion must not trade the inset away: the rows keep
      // their breathing room while the set narrows.
      fireEvent.change(screen.getByTestId('narrow-links'), { target: { value: 'long' } });
      expect(screen.getByTestId('dashboard-links-rows')).toHaveStyle({
        paddingLeft: '16px',
        paddingRight: '16px',
      });
    });

    it('keeps every row on one shared track template so columns align across rows', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ data: LINKS })));
      renderDashboard();
      await waitFor(() => expect(screen.getByTestId('link-row-abc')).toBeInTheDocument());

      const rows = screen.getAllByTestId(/^link-row-/);
      expect(rows).toHaveLength(2);
      // One hoisted row style: every row in the set carries the same
      // generated classes — no row restyles its own columns.
      expect(new Set(rows.map((row) => row.className)).size).toBe(1);

      // The set's single shared template (bounded tracks; the destination
      // is the widest flexible track) and the subgrid adoption that pins
      // like-positioned standings to the same x in every row.
      const styles = Array.from(document.querySelectorAll('style'))
        .map((sheet) => sheet.textContent ?? '')
        .join('');
      expect(styles).toContain('minmax(0, 1fr) minmax(0, 3fr) max-content max-content auto');
      expect(styles).toContain('grid-template-columns:subgrid');
    });
  });
});
