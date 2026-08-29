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

// The opened record: the leave reach and the link's identity, then the three
// readings in order — the total numeral with its honesty qualification, the
// one course-over-time depiction, and the two ranked breakdowns. The global
// MSW handler for GET /api/stats/:slug covers the data fetch.
export const Default: Story = {};

// The zero-use record: the magnitude itself is the honest answer — the numeral
// reads 0 with the same qualification, and the course and breakdowns state
// that nothing is recorded.
export const ZeroUse: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/stats/:slug', () =>
          HttpResponse.json({
            slug: 'abc123',
            totalClicks: 0,
            byDay: [],
            byCountry: [],
            byBrowser: [],
          }),
        ),
      ],
    },
  },
};

// Error state: the stats endpoint returns 500 so the page renders the error
// statement instead of the record.
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
