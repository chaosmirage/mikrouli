import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { TestQueryClientProvider } from '../test/queryClient';
import StatsPage from './StatsPage';
import { createAppTheme } from '../theme';
import * as client from '../api/client';
import type { StatsAggregate } from '../api/types';

const SLUG = 'abc123';
const LIGHT_THEME = createAppTheme('light');

const STATS_FIXTURE: StatsAggregate = {
  slug: SLUG,
  totalClicks: 42,
  byDay: [
    { period: '2026-05-01', clicks: 10 },
    { period: '2026-05-02', clicks: 15 },
    { period: '2026-05-03', clicks: 17 },
  ],
  byCountry: [
    { country: 'US', clicks: 12 },
    { country: 'DE', clicks: 25 },
    // An unresolvable place arrives as an empty name, not as a fabricated one.
    { country: '', clicks: 5 },
  ],
  byBrowser: [
    { browser: 'Chrome', clicks: 30 },
    { browser: 'Firefox', clicks: 12 },
  ],
};

const ZERO_USE_FIXTURE: StatsAggregate = {
  slug: SLUG,
  totalClicks: 0,
  byDay: [],
  byCountry: [],
  byBrowser: [],
};

function renderStatsAt(slug: string) {
  render(
    <ThemeProvider theme={LIGHT_THEME}>
      <TestQueryClientProvider>
        <MemoryRouter initialEntries={[`/stats/${slug}`]}>
          <Routes>
            <Route path="/stats/:slug" element={<StatsPage />} />
            <Route path="/dashboard" element={<div>dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </TestQueryClientProvider>
    </ThemeProvider>,
  );
}

async function renderStatsView(fixture: StatsAggregate = STATS_FIXTURE) {
  vi.spyOn(client, 'apiFetch').mockResolvedValue(fixture);
  renderStatsAt(SLUG);
  await waitFor(() => expect(screen.getByTestId('stats-view')).toBeInTheDocument());
}

describe('StatsPage', () => {
  beforeEach(() => {
    vi.spyOn(client, 'apiFetch').mockResolvedValue(STATS_FIXTURE);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the slug heading with the leave reach back to the set', async () => {
    await renderStatsView();
    expect(screen.getByTestId('stats-slug')).toHaveTextContent(SLUG);
    const leave = screen.getByTestId('stats-leave');
    expect(leave).toHaveAttribute('href', '/dashboard');
    expect(leave).toHaveTextContent('All links');
  });

  it('reads the short address in the fixed-width technical register', async () => {
    await renderStatsView();
    const shortAddress = screen.getByTestId('stats-slug');
    // A character-exact address must be read character-exactly: the mono
    // stack, never the sans body family the surrounding prose uses.
    expect(getComputedStyle(shortAddress).fontFamily).toBe(
      LIGHT_THEME.typography.technical.fontFamily,
    );
    expect(getComputedStyle(shortAddress).fontFamily).not.toBe(
      LIGHT_THEME.typography.body.fontFamily,
    );
  });

  it('names where the short address resolves in the identity, as meta', async () => {
    // The stats resource does not carry the destination; the record reads it
    // from the owner's set, so the identity names both ends of the link.
    const routeByPath = async (path: string): Promise<unknown> =>
      String(path).includes('/api/urls')
        ? {
            data: [
              {
                createdAt: '2026-05-01T00:00:00Z',
                shortUrl: SLUG,
                originalUrl: 'https://example.com/the-destination',
                expiresAt: null,
              },
              {
                createdAt: '2026-05-01T00:00:00Z',
                shortUrl: 'other',
                originalUrl: 'https://example.com/unrelated',
                expiresAt: null,
              },
            ],
          }
        : STATS_FIXTURE;
    vi.spyOn(client, 'apiFetch').mockImplementation(
      routeByPath as unknown as typeof client.apiFetch,
    );
    renderStatsAt(SLUG);
    await waitFor(() => expect(screen.getByTestId('stats-view')).toBeInTheDocument());
    expect(screen.getByTestId('stats-destination')).toHaveTextContent(
      'https://example.com/the-destination',
    );
  });

  it('renders the total as one numeral with its honesty qualification', async () => {
    await renderStatsView();
    expect(screen.getByTestId('stats-total')).toHaveTextContent('42');
    expect(screen.getByText('recorded redirects')).toBeVisible();
  });

  it('carries the course over time as the only chart reading', async () => {
    await renderStatsView();
    expect(screen.getByTestId('stats-clicks-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('stats-countries-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stats-browsers-chart')).not.toBeInTheDocument();
  });

  it('states each breakdown once as ranked rows with their honest shares', async () => {
    await renderStatsView();
    // Ranked by recorded clicks, each row naming its share of the certain
    // total: DE 25/42 before US 12/42 before the honest Unknown 5/42.
    const rankedCountryRows = within(screen.getByTestId('stats-countries-rows'))
      .getAllByTestId('stats-countries-rows-row')
      .map((row) => row.textContent);
    expect(rankedCountryRows).toEqual(['DE60%', 'US29%', 'Unknown12%']);

    const rankedBrowserRows = within(screen.getByTestId('stats-browsers-rows'))
      .getAllByTestId('stats-browsers-rows-row')
      .map((row) => row.textContent);
    expect(rankedBrowserRows).toEqual(['Chrome71%', 'Firefox29%']);
  });

  it('removes the duplicated drill-down tables under the readings', async () => {
    await renderStatsView();
    expect(screen.queryByTestId('stats-days-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stats-countries-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stats-browsers-section')).not.toBeInTheDocument();
  });

  it('orders the readings magnitude, trend, comparison', async () => {
    await renderStatsView();
    const total = screen.getByTestId('stats-total');
    const chart = screen.getByTestId('stats-clicks-chart');
    const countries = screen.getByTestId('stats-countries-rows');
    expect(total.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      chart.compareDocumentPosition(countries) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('reads zero use as the magnitude itself, honest at the same glance', async () => {
    await renderStatsView(ZERO_USE_FIXTURE);
    expect(screen.getByTestId('stats-total')).toHaveTextContent(/^0$/);
    expect(screen.getByText('recorded redirects')).toBeVisible();
    expect(screen.getAllByText('No clicks recorded yet').length).toBeGreaterThan(0);
  });

  it('shows an error alert when the api returns 404', async () => {
    vi.spyOn(client, 'apiFetch').mockRejectedValue(new client.ApiError(404, 'not found'));
    renderStatsAt(SLUG);
    await waitFor(() => expect(screen.getByTestId('stats-error')).toBeInTheDocument());
  });

  it('shows an error alert when the api returns 403', async () => {
    vi.spyOn(client, 'apiFetch').mockRejectedValue(new client.ApiError(403, 'forbidden'));
    renderStatsAt(SLUG);
    await waitFor(() => expect(screen.getByTestId('stats-error')).toBeInTheDocument());
  });
});
