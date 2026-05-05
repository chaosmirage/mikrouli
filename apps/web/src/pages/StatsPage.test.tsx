import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import StatsPage from './StatsPage';
import { theme } from '../theme';
import * as client from '../api/client';
import type { StatsAggregate } from '../api/types';

const SLUG = 'abc123';

const STATS_FIXTURE: StatsAggregate = {
  slug: SLUG,
  totalClicks: 42,
  byDay: [
    { period: '2026-05-01', clicks: 10 },
    { period: '2026-05-02', clicks: 15 },
    { period: '2026-05-03', clicks: 17 },
  ],
  byCountry: [
    { country: 'DE', clicks: 25 },
    { country: 'US', clicks: 12 },
    { country: 'FR', clicks: 5 },
  ],
  byBrowser: [
    { browser: 'Chrome', clicks: 30 },
    { browser: 'Firefox', clicks: 12 },
  ],
};

function renderStatsAt(slug: string) {
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[`/stats/${slug}`]}>
        <Routes>
          <Route path="/stats/:slug" element={<StatsPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('StatsPage', () => {
  beforeEach(() => {
    vi.spyOn(client, 'apiFetch').mockResolvedValue(STATS_FIXTURE);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the slug heading and total clicks card', async () => {
    renderStatsAt(SLUG);
    await waitFor(() => expect(screen.getByTestId('stats-view')).toBeInTheDocument());
    expect(screen.getByTestId('stats-slug')).toHaveTextContent(SLUG);
    expect(screen.getByTestId('stats-total')).toHaveTextContent('42');
  });

  it('renders all three diagram cards when data is present', async () => {
    renderStatsAt(SLUG);
    await waitFor(() => expect(screen.getByTestId('stats-view')).toBeInTheDocument());
    expect(screen.getByTestId('stats-clicks-chart')).toBeInTheDocument();
    expect(screen.getByTestId('stats-countries-chart')).toBeInTheDocument();
    expect(screen.getByTestId('stats-browsers-chart')).toBeInTheDocument();
  });

  it('keeps the existing tables underneath as drill-down', async () => {
    renderStatsAt(SLUG);
    await waitFor(() => expect(screen.getByTestId('stats-view')).toBeInTheDocument());
    expect(screen.getByTestId('stats-days-section')).toBeInTheDocument();
    expect(screen.getByTestId('stats-countries-section')).toBeInTheDocument();
    expect(screen.getByTestId('stats-browsers-section')).toBeInTheDocument();
  });

  it('shows an error alert when the api returns 404', async () => {
    vi.spyOn(client, 'apiFetch').mockRejectedValue(new client.ApiError('not found', 404));
    renderStatsAt(SLUG);
    await waitFor(() => expect(screen.getByTestId('stats-error')).toBeInTheDocument());
  });

  it('shows an error alert when the api returns 403', async () => {
    vi.spyOn(client, 'apiFetch').mockRejectedValue(new client.ApiError('forbidden', 403));
    renderStatsAt(SLUG);
    await waitFor(() => expect(screen.getByTestId('stats-error')).toBeInTheDocument());
  });
});
