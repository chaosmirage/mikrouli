import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { TestQueryClientProvider } from '../test/queryClient';
import ApiKeysPage from './ApiKeysPage';
import { createAppTheme } from '../theme';

const ACTIVE_KEY = {
  id: 'k1',
  label: 'my-key',
  keyPrefix: 'mk_a1b2',
  createdAt: '2024-01-01T00:00:00Z',
  lastUsedAt: null,
  revokedAt: null,
};

function makeResponse(data: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    json: () => Promise.resolve(data),
    headers: { get: () => null },
  };
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

/** A theme hex as the `rgb(r, g, b)` string computed styles speak. */
function rgbOf(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ data: [] })));
});

describe('ApiKeysPage', () => {
  it('names the surface with a heading and one capability line', async () => {
    renderApiKeys();
    await waitFor(() => expect(screen.getByTestId('key-label')).toBeInTheDocument());
    expect(screen.getByRole('heading', { level: 1, name: 'API keys' })).toBeInTheDocument();
    expect(screen.getByText(/machine access/i)).toBeInTheDocument();
  });

  it('renders key label input and create button', async () => {
    renderApiKeys();
    await waitFor(() => expect(screen.getByTestId('key-label')).toBeInTheDocument());
    expect(screen.getByTestId('key-create')).toBeInTheDocument();
  });

  it('creates a key and shows the secret once with its receipt stated', async () => {
    const newKey = {
      id: 'k1',
      label: 'test',
      key: 'secret-value-xyz',
      keyPrefix: 'key_sec',
      createdAt: '2024-01-01T00:00:00Z',
    };
    const summary = { ...newKey, lastUsedAt: null, revokedAt: null };
    const mockFetch = vi.fn();
    mockFetch.mockResolvedValueOnce(makeResponse({ data: [] }));
    mockFetch.mockResolvedValueOnce(makeResponse(newKey));
    mockFetch.mockResolvedValueOnce(makeResponse({ data: [summary] }));
    vi.stubGlobal('fetch', mockFetch);
    renderApiKeys();
    await waitFor(() => expect(screen.getByTestId('key-label')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('key-label'), { target: { value: 'test' } });
    fireEvent.click(screen.getByTestId('key-create'));
    await waitFor(() => expect(screen.getByTestId('key-secret-once')).toBeInTheDocument());
    // The secret stands as its own readable value inside the one showing.
    expect(screen.getByTestId('key-secret-value')).toHaveTextContent('secret-value-xyz');
    // Its receipt is stated as the aftermath of the issuing act.
    expect(screen.getByText(/shown once and never again/i)).toBeInTheDocument();
  });

  it.each(['light', 'dark'] as const)(
    '%s mode: stands the one showing on the accent-tinted surface',
    async (mode) => {
      const newKey = {
        id: 'k1',
        label: 'test',
        key: 'secret-value-xyz',
        keyPrefix: 'key_sec',
        createdAt: '2024-01-01T00:00:00Z',
      };
      const mockFetch = vi.fn();
      mockFetch.mockResolvedValueOnce(makeResponse({ data: [] }));
      mockFetch.mockResolvedValueOnce(makeResponse(newKey));
      mockFetch.mockResolvedValueOnce(makeResponse({ data: [] }));
      vi.stubGlobal('fetch', mockFetch);
      const theme = createAppTheme(mode);
      render(
        <ThemeProvider theme={theme}>
          <MemoryRouter>
            <TestQueryClientProvider>
              <ApiKeysPage />
            </TestQueryClientProvider>
          </MemoryRouter>
        </ThemeProvider>,
      );
      await waitFor(() => expect(screen.getByTestId('key-label')).toBeInTheDocument());
      fireEvent.change(screen.getByTestId('key-label'), { target: { value: 'test' } });
      fireEvent.click(screen.getByTestId('key-create'));
      await waitFor(() => expect(screen.getByTestId('key-secret-once')).toBeInTheDocument());

      // The one showing carries the accent family's quiet tint (accent/subtle)
      // as its ground and the control radius, so it reads as set apart from
      // every raised surface around it — a tint, never an accent-filled mark.
      const showing = screen.getByTestId('key-secret-once');
      const stated = getComputedStyle(showing);
      expect(stated.backgroundColor).toBe(rgbOf(theme.palette.primary.light));
      expect(stated.borderRadius).toBe(`${theme.shape.borderRadius}px`);
    },
  );

  it('states the issuing as under way while the create call is in flight', async () => {
    const mockFetch = vi.fn();
    mockFetch.mockResolvedValueOnce(makeResponse({ data: [] }));
    mockFetch.mockReturnValueOnce(new Promise(() => {}));
    vi.stubGlobal('fetch', mockFetch);
    renderApiKeys();
    await waitFor(() => expect(screen.getByTestId('key-label')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('key-label'), { target: { value: 'test' } });
    fireEvent.click(screen.getByTestId('key-create'));
    await waitFor(() => expect(screen.getByText('In progress…')).toBeInTheDocument());
  });

  it('states a refused create as the resolved problem-details message', async () => {
    const mockFetch = vi.fn();
    mockFetch.mockResolvedValueOnce(makeResponse({ data: [] }));
    mockFetch.mockResolvedValueOnce(makeResponse({ detail: 'label is too long' }, 400));
    vi.stubGlobal('fetch', mockFetch);
    renderApiKeys();
    await waitFor(() => expect(screen.getByTestId('key-label')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('key-label'), { target: { value: 'test' } });
    fireEvent.click(screen.getByTestId('key-create'));
    await waitFor(() => expect(screen.getByText('label is too long')).toBeInTheDocument());
  });

  it('retires a key with one act on the row, with no confirmation staged', async () => {
    const mockFetch = vi.fn();
    mockFetch.mockResolvedValueOnce(makeResponse({ data: [ACTIVE_KEY] }));
    mockFetch.mockResolvedValueOnce(makeResponse(null, 204));
    mockFetch.mockResolvedValueOnce(makeResponse({ data: [] }));
    vi.stubGlobal('fetch', mockFetch);
    renderApiKeys();
    await waitFor(() => expect(screen.getByTestId('revoke-k1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('revoke-k1'));
    // The DELETE call fires from the single act; no dialog ever stands over.
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3));
    expect(screen.queryByTestId('revoke-confirm')).not.toBeInTheDocument();
    expect(screen.queryByTestId('revoke-dialog')).not.toBeInTheDocument();
  });

  it('names the retire reach for screen readers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ data: [ACTIVE_KEY] })));
    renderApiKeys();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Retire my-key' })).toBeInTheDocument(),
    );
  });

  it('shows the honest empty when no keys stand', async () => {
    renderApiKeys();
    await waitFor(() => expect(screen.getByText('No API keys yet')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('No API keys yet');
    expect(screen.queryByTestId('api-keys-table')).not.toBeInTheDocument();
  });

  describe('the review rows compare on one shared track template', () => {
    const SHORT_NAME_KEY = { ...ACTIVE_KEY, id: 'k1', label: 'my-key' };
    const LONG_NAME_KEY = {
      ...ACTIVE_KEY,
      id: 'k2',
      label: 'a-considerably-longer-credential-name',
    };

    it('keeps every review row on the set template so columns align across rows', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(makeResponse({ data: [SHORT_NAME_KEY, LONG_NAME_KEY] })),
      );
      renderApiKeys();
      await waitFor(() => expect(screen.getByTestId('api-keys-rows')).toBeInTheDocument());

      const rows = screen.getAllByTestId(/^key-row-/);
      expect(rows).toHaveLength(2);
      // One hoisted row style: every row in the review carries the same
      // generated classes — no row restyles its own columns.
      expect(new Set(rows.map((row) => row.className)).size).toBe(1);

      // The set's single shared template (the name track bounded; the
      // standings size to their strings; the retire reach ends the row) and
      // the subgrid adoption that pins like-positioned standings to the
      // same x in every row, whatever a credential is named.
      const styles = Array.from(document.querySelectorAll('style'))
        .map((sheet) => sheet.textContent ?? '')
        .join('');
      expect(styles).toContain('minmax(0, 1fr) max-content max-content auto');
      expect(styles).toContain('grid-template-columns:subgrid');
    });

    it('bounds the key name inside its own track: a longer name wraps, never pushing the columns', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(makeResponse({ data: [SHORT_NAME_KEY, LONG_NAME_KEY] })),
      );
      renderApiKeys();
      await waitFor(() => expect(screen.getByTestId('key-row-k2')).toBeInTheDocument());

      // minWidth 0 lets the name shrink below its content inside its
      // bounded track; break-anywhere folds a spaceless name there too —
      // so the name widens its own track only, never another column's x.
      const name = screen.getByText('a-considerably-longer-credential-name');
      expect(name).toHaveStyle({ minWidth: '0' });
      expect(name).toHaveStyle({ overflowWrap: 'anywhere' });
    });
  });
});
