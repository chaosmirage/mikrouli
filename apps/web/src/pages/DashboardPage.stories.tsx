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

// A very long, spaceless destination (a documents-style URL) beside a short
// one: the row must contain the long URL — it wraps inside its own track
// instead of overflowing the row or moving the other columns — so both
// rows' Created/Expired/acts columns align, and the in-row correction stays
// within its track at every viewport.
export const LongDestination: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/urls', () =>
          HttpResponse.json({
            data: [
              {
                shortUrl: 'docs-link',
                originalUrl: `https://docs.example.com/document/d/${'a'.repeat(320)}/edit`,
                createdAt: '2026-01-15T09:00:00Z',
                expiresAt: '2027-01-15T09:00:00Z',
              },
              {
                shortUrl: 'short',
                originalUrl: 'https://example.com/usage-count-target',
                createdAt: '2026-02-05T09:00:00Z',
                expiresAt: null,
              },
            ],
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
