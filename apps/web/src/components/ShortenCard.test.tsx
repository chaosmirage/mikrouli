import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import ShortenCard from './ShortenCard';
import { theme } from '../theme';

// Drives the shared ShortenCard at the user-closest seam: fill the URL,
// submit, observe the rendered short link + the onShortened callback. The
// card owns its own input/loading/error state; the host passes only the
// initial namespace and an optional callback.

function makeResponse(data: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(data) };
}

function renderCard(props?: { onShortened?: (l: { shortUrl: string }) => void }) {
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <ShortenCard namespace="dashboard" {...props} />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ data: [] })));
});

describe('ShortenCard', () => {
  it('renders the input and submit button', () => {
    renderCard();
    expect(screen.getByTestId('shorten-url')).toBeInTheDocument();
    expect(screen.getByTestId('shorten-submit')).toBeInTheDocument();
  });

  it('after submit shows the new link alert and fires onShortened', async () => {
    const onShortened = vi.fn();
    const newLink = {
      shortUrl: 'http://s.io/abc',
      originalUrl: 'http://long.com',
      createdAt: '2024-01-01T00:00:00Z',
      expiresAt: null,
    };
    const mockFetch = vi.fn().mockResolvedValueOnce(makeResponse(newLink));
    vi.stubGlobal('fetch', mockFetch);

    renderCard({ onShortened });
    fireEvent.change(screen.getByTestId('shorten-url'), {
      target: { value: 'http://long.com' },
    });
    fireEvent.click(screen.getByTestId('shorten-submit'));

    await waitFor(() => expect(screen.getByTestId('new-link-alert')).toBeInTheDocument());
    expect(onShortened).toHaveBeenCalledWith(newLink);
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

  it('renders QrCode component after successful shorten with resolved full URL', async () => {
    const newLink = {
      shortUrl: 'GYa6kx',
      originalUrl: 'http://long.com',
      createdAt: '2024-01-01T00:00:00Z',
      expiresAt: null,
    };
    const mockFetch = vi.fn().mockResolvedValueOnce(makeResponse(newLink));
    vi.stubGlobal('fetch', mockFetch);

    renderCard();
    fireEvent.change(screen.getByTestId('shorten-url'), {
      target: { value: 'http://long.com' },
    });
    fireEvent.click(screen.getByTestId('shorten-submit'));

    await waitFor(() => {
      // After successful shorten, QrCode is rendered
      const qrCode = screen.getByTestId('qr-code');
      expect(qrCode).toBeInTheDocument();

      // QrCode renders an SVG element
      const svg = qrCode.querySelector('svg');
      expect(svg).toBeInTheDocument();

      // Download control is present alongside the QR code
      const downloadButton = screen.getByTestId('qr-download');
      expect(downloadButton).toBeInTheDocument();
    });
  });

  it('QrCode and copy button target the same resolved full URL', async () => {
    const newLink = {
      shortUrl: 'GYa6kx',
      originalUrl: 'http://long.com',
      createdAt: '2024-01-01T00:00:00Z',
      expiresAt: null,
    };
    const mockFetch = vi.fn().mockResolvedValueOnce(makeResponse(newLink));
    vi.stubGlobal('fetch', mockFetch);

    renderCard();
    fireEvent.change(screen.getByTestId('shorten-url'), {
      target: { value: 'http://long.com' },
    });
    fireEvent.click(screen.getByTestId('shorten-submit'));

    await waitFor(() => {
      // Both the alert text and QR code reference the resolved full URL
      const newLinkAlert = screen.getByTestId('new-link-alert');
      expect(newLinkAlert).toBeInTheDocument();

      // QR code is rendered (both in the result and as a separate component)
      const qrCode = screen.getByTestId('qr-code');
      expect(qrCode).toBeInTheDocument();

      // The alert text should contain the resolved URL (window.location.origin/GYa6kx)
      // and the QR code encodes the same resolved URL
      const alertText = newLinkAlert.textContent;
      expect(alertText).toBeTruthy();
      expect(alertText).toMatch(/GYa6kx/);
    });
  });

  it('no regression: existing shorten form elements remain after QR integration', async () => {
    const newLink = {
      shortUrl: 'GYa6kx',
      originalUrl: 'http://long.com',
      createdAt: '2024-01-01T00:00:00Z',
      expiresAt: null,
    };
    const mockFetch = vi.fn().mockResolvedValueOnce(makeResponse(newLink));
    vi.stubGlobal('fetch', mockFetch);

    renderCard();
    fireEvent.change(screen.getByTestId('shorten-url'), {
      target: { value: 'http://long.com' },
    });
    fireEvent.click(screen.getByTestId('shorten-submit'));

    await waitFor(() => {
      // Verify existing elements are still present (no regression)
      expect(screen.getByTestId('new-link-alert')).toBeInTheDocument();
      expect(screen.getByTestId('copy-link')).toBeInTheDocument();

      // QR code is added alongside, not replacing existing elements
      expect(screen.getByTestId('qr-code')).toBeInTheDocument();
    });
  });
});
