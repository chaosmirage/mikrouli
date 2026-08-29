import type { Meta, StoryObj } from '@storybook/react';
import { http, HttpResponse } from 'msw';
import DashboardPage from './DashboardPage';
import { withAuthPage } from '../../.storybook/decorators';

const meta: Meta<typeof DashboardPage> = {
  title: 'Pages/DashboardPage',
  component: DashboardPage,
  decorators: [withAuthPage],
};

export default meta;

type Story = StoryObj<typeof DashboardPage>;

// Default state: the create act over the set of owned links. The global MSW
// handlers for /api/urls cover the data fetching; rows stand as labeled
// standings with locale-convention dates.
export const Default: Story = {};

// A set large enough to need narrowing: eight owned links, the narrowing
// entering at the set's head.
export const FullSet: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/urls', () =>
          HttpResponse.json({
            data: Array.from({ length: 8 }, (_, i) => ({
              shortUrl: `link${i + 1}`,
              originalUrl: `https://example.com/destination-${i + 1}`,
              createdAt: `2026-0${(i % 9) + 1}-15T09:00:00Z`,
              expiresAt: i % 3 === 0 ? null : `2027-0${(i % 9) + 1}-15T09:00:00Z`,
            })),
          }),
        ),
      ],
    },
  },
};

// Empty state: no links yet. The set is replaced by the honest empty message.
export const EmptyState: Story = {
  parameters: {
    msw: {
      handlers: [http.get('/api/urls', () => HttpResponse.json({ data: [] }))],
    },
  },
};

// Failure state: the list could not be gathered; the resolved failure
// statement stands in the set's place.
export const FetchError: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/urls', () =>
          HttpResponse.json(
            { title: 'The links could not be loaded', status: 500 },
            { status: 500 },
          ),
        ),
      ],
    },
  },
};
