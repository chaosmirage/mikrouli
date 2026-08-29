import type { Meta, StoryObj } from '@storybook/react';
import { http, HttpResponse } from 'msw';
import UsagePage from './UsagePage';
import { withAuthPage } from '../../.storybook/decorators';

const meta: Meta<typeof UsagePage> = {
  title: 'Pages/UsagePage',
  component: UsagePage,
  decorators: [withAuthPage],
};

export default meta;

type Story = StoryObj<typeof UsagePage>;

// Default state: the capability statement, the two standings (42/100 links,
// 3/10 keys) with their fill proportions, the reset and retention standings,
// and the request-more reach. The global MSW handlers cover GET /api/usage and
// GET /api/auth/me.
export const Default: Story = {};

// State where the short-link allowance is exhausted: the fill proportion reads
// full and the exhausted statement stands as resolved matter with it.
export const Exhausted: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/usage', () =>
          HttpResponse.json({
            linksCreated: 100,
            linkLimit: 100,
            linksRemaining: 0,
            keysCreated: 3,
            keyLimit: 10,
            keysRemaining: 7,
            resetDate: '2026-07-01T00:00:00.000Z',
            retentionMs: 94_608_000_000,
          }),
        ),
      ],
    },
  },
};
