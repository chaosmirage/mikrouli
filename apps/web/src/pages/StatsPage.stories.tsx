import type { Meta, StoryObj } from '@storybook/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import Container from '@mui/material/Container';
import StatsPage from './StatsPage';
import { AuthProvider } from '../auth/AuthContext';

// StatsPage reads the slug from useParams, so the story must mount it under a
// route with a :slug parameter. This single combined decorator wraps the page
// in a MemoryRouter seeded with a concrete slug, then layers QueryClient +
// Auth + Container inside the Route element (mirroring the real provider tree
// order: Router > QueryClient > Auth > Container > Story).
function withStatsPageProviders(Story: () => ReactNode): React.JSX.Element {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return (
    <MemoryRouter initialEntries={['/stats/abc123']}>
      <Routes>
        <Route
          path="/stats/:slug"
          element={
            <QueryClientProvider client={client}>
              <AuthProvider>
                <Container maxWidth="lg" sx={{ py: 5 }}>
                  <Story />
                </Container>
              </AuthProvider>
            </QueryClientProvider>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

const meta: Meta<typeof StatsPage> = {
  title: 'Pages/StatsPage',
  component: StatsPage,
  decorators: [withStatsPageProviders],
};

export default meta;

type Story = StoryObj<typeof StatsPage>;

// Default state: chart series (by day, by country, by browser) and the total
// clicks number rendered from the mock aggregate for slug "abc123". The global
// MSW handler for GET /api/stats/:slug covers the data fetch.
export const Default: Story = {};

// Error state: the stats endpoint returns 500 so the page renders the error
// alert instead of the charts.
export const Error: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/stats/:slug', () =>
          HttpResponse.json({ title: 'Internal error', status: 500 }, { status: 500 }),
        ),
      ],
    },
  },
};
