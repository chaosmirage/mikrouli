import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import ShortenCard from './ShortenCard';
import { createAppTheme } from '../theme';

// Drives the shorten act and its result moment at the user-closest seam: enter
// a long address, confirm once, observe the confirmation + takeable short
// address + QR exports, and the onShortened callback contract the hosts rely
// on for the register nudge.

function makeResponse(data: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(data) };
}

const NEW_LINK = {
  shortUrl: 'GYa6kx',
  originalUrl: 'http://long.com',
  createdAt: '2024-01-01T00:00:00Z',
  expiresAt: null,
};

// jsdom ships no Async Clipboard API; the copy taking needs a working one.
function installWorkingClipboard(): void {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: () => Promise.resolve() },
  });
}

function renderCard(props?: {
  namespace?: 'dashboard' | 'landing';
  bare?: boolean;
  onShortened?: (l: typeof NEW_LINK) => void;
}) {
  render(
    <ThemeProvider theme={createAppTheme('light')}>
      <MemoryRouter>
        <ShortenCard
          namespace={props?.namespace ?? 'dashboard'}
          bare={props?.bare}
          onShortened={props?.onShortened}
        />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

async function submitLongUrl() {
  fireEvent.change(screen.getByTestId('shorten-url'), {
    target: { value: 'http://long.com' },
  });
  fireEvent.click(screen.getByTestId('shorten-submit'));
  await waitFor(() =>
    expect(screen.getByTestId('result-confirmation')).toBeInTheDocument(),
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ data: [] })));
});

afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: undefined,
  });
});

describe('ShortenCard', () => {
  it('renders the entering and the confirm control', () => {
    renderCard();
    expect(screen.getByTestId('shorten-url')).toBeInTheDocument();
    expect(screen.getByTestId('shorten-submit')).toBeInTheDocument();
  });

  it('resolves the guest act labels from the landing namespace', () => {
    renderCard({ namespace: 'landing' });
    expect(screen.getByTestId('shorten-url')).toHaveAttribute(
      'value',
      '',
    );
    expect(screen.getByTestId('shorten-submit')).toHaveTextContent('Shorten');
  });

  it('after submit confirms the link exists and fires onShortened with the link', async () => {
    const onShortened = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(makeResponse(NEW_LINK)),
    );

    renderCard({ onShortened });
    await submitLongUrl();

    // The preserved address the e2e shorten flow has always driven: the whole
    // result moment stays reachable as `new-link-alert`, with the finer
    // confirmation/link addresses on its children.
    expect(screen.getByTestId('new-link-alert')).toBeInTheDocument();
    expect(screen.getByTestId('result-confirmation')).toBeInTheDocument();
    expect(onShortened).toHaveBeenCalledWith(NEW_LINK);
  });

  it('shows the short address as readable takeable text beside the copy control', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(makeResponse(NEW_LINK)),
    );

    renderCard();
    await submitLongUrl();

    const address = screen.getByTestId('result-link');
    expect(address.textContent).toMatch(/GYa6kx/);
    // A bare slug resolves against the current origin.
    expect(address.textContent).toContain(`${window.location.origin}/GYa6kx`);
    expect(screen.getByTestId('copy-link')).toBeInTheDocument();
  });

  it('shows the copy-landed confirmation in the same glance after one activation', async () => {
    installWorkingClipboard();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(makeResponse(NEW_LINK)),
    );

    renderCard();
    await submitLongUrl();

    fireEvent.click(screen.getByTestId('copy-link'));

    // The confirmation arrives once the clipboard write resolves.
    expect(await screen.findByText('Copied')).toBeInTheDocument();
    // The moment persists: address, code, and both exports stay reachable.
    expect(screen.getByTestId('result-link')).toBeInTheDocument();
    expect(screen.getByTestId('qr-code')).toBeInTheDocument();
    expect(screen.getByTestId('qr-download')).toBeInTheDocument();
    expect(screen.getByTestId('qr-download-svg')).toBeInTheDocument();
  });

  it('keeps both QR export formats beside the code after a successful shorten', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(makeResponse(NEW_LINK)),
    );

    renderCard();
    await submitLongUrl();

    const qrCode = screen.getByTestId('qr-code');
    expect(qrCode.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByTestId('qr-download')).toBeInTheDocument();
    expect(screen.getByTestId('qr-download-svg')).toBeInTheDocument();
  });

  it('renders the API error message on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: () =>
          Promise.resolve({
            type: 'about:blank',
            title: 'Validation error',
            status: 422,
            errors: [{ field: 'url', message: 'invalid url', rule: 'url' }],
          }),
      }),
    );
    renderCard();
    fireEvent.change(screen.getByTestId('shorten-url'), {
      target: { value: 'not-a-url' },
    });
    fireEvent.click(screen.getByTestId('shorten-submit'));
    await waitFor(() => expect(screen.getByTestId('shorten-error')).toBeInTheDocument());
  });

  it('renders no register offer on the signed-in host', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(makeResponse(NEW_LINK)),
    );

    renderCard();
    await submitLongUrl();

    expect(screen.queryByTestId('guest-nudge')).not.toBeInTheDocument();
  });

  describe('guest landing register (bare)', () => {
    it('the moment replaces the entering row and states the confirmation in the accent ink', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce(makeResponse(NEW_LINK)),
      );

      renderCard({ namespace: 'landing', bare: true });
      await submitLongUrl();

      // The value stands alone: no second act beside it (frame S2).
      expect(screen.queryByTestId('shorten-url')).not.toBeInTheDocument();
      expect(screen.queryByTestId('shorten-submit')).not.toBeInTheDocument();
      expect(screen.getByTestId('new-link-alert')).toBeInTheDocument();
      expect(screen.getByTestId('result-confirmation')).toHaveTextContent(
        /link created/i,
      );
      expect(screen.getByTestId('result-link')).toHaveTextContent(/GYa6kx/);
    });

    it('the take is a labeled control whose landed statement stands beside it', async () => {
      installWorkingClipboard();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce(makeResponse(NEW_LINK)),
      );

      renderCard({ namespace: 'landing', bare: true });
      await submitLongUrl();

      const take = screen.getByTestId('copy-link');
      expect(take).toHaveTextContent('Copy');

      fireEvent.click(take);
      expect(await screen.findByTestId('copy-link-landed')).toBeInTheDocument();
      expect(screen.getByTestId('copy-link-landed')).toHaveTextContent(
        /copied to clipboard/i,
      );

      // The cluster keeps both exports in the same glance.
      expect(screen.getByTestId('qr-code')).toBeInTheDocument();
      expect(screen.getByTestId('qr-download')).toBeInTheDocument();
      expect(screen.getByTestId('qr-download-svg')).toBeInTheDocument();
    });
  });
});
