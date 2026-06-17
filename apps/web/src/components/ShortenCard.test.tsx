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
});
