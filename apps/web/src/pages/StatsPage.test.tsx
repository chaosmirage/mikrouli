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
    expect(leave).toHaveTextContent('Back to dashboard');
  });

  it('renders the total as one numeral with its honesty qualification', async () => {
    await renderStatsView();
    expect(screen.getByTestId('stats-total')).toHaveTextContent('42');
    expect(screen.getByText('Recorded redirects')).toBeVisible();
  });

  it('carries the course over time as the only chart reading', async () => {
    await renderStatsView();
    expect(screen.getByTestId('stats-clicks-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('stats-countries-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stats-browsers-chart')).not.toBeInTheDocument();
  });

  it('states each breakdown once as ranked labeled rows', async () => {
    await renderStatsView();
    const countries = screen.getByTestId('stats-countries-rows');
    const rankedCountryNames = within(countries)
      .getAllByRole('listitem')
      .map((row) => row.textContent);
    // Ranked by recorded clicks: DE 25 before US 12 before the honest Unknown 5.
    expect(rankedCountryNames).toEqual(['DE25', 'US12', 'Unknown5']);

    const browsers = screen.getByTestId('stats-browsers-rows');
    expect(
      within(browsers)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual(['Chrome30', 'Firefox12']);
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
    expect(screen.getByText('Recorded redirects')).toBeVisible();
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
