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

// Default state: three short links in the table, the shorten card idle, and the
// QR code hidden until a shorten succeeds. The global MSW handlers for
// GET/POST/DELETE /api/urls cover the data fetching.
export const Default: Story = {};

// Empty state: no links yet. The table is replaced by the empty-state message.
export const EmptyState: Story = {
  parameters: {
    msw: {
      handlers: [http.get('/api/urls', () => HttpResponse.json({ data: [] }))],
    },
  },
};
