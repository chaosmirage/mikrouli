import type { Meta, StoryObj } from '@storybook/react';
import UsagePage from './UsagePage';
import { withAuthPage } from '../../.storybook/decorators';

const meta: Meta<typeof UsagePage> = {
  title: 'Pages/UsagePage',
  component: UsagePage,
  decorators: [withAuthPage],
};

export default meta;

type Story = StoryObj<typeof UsagePage>;

// Default state: quota cards (42/100 links, 3/10 keys), retention info, and the
// request-more button. The global MSW handlers cover GET /api/usage and
// GET /api/auth/me.
export const Default: Story = {};
