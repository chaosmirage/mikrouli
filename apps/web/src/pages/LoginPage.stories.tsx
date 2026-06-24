import type { Meta, StoryObj } from '@storybook/react';
import { http, HttpResponse } from 'msw';
import LoginPage from './LoginPage';
import { withGuestPage } from '../../.storybook/decorators';

const meta: Meta<typeof LoginPage> = {
  title: 'Pages/LoginPage',
  component: LoginPage,
  decorators: [withGuestPage],
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj<typeof LoginPage>;

// Default state: empty form with email/password fields, GitHub OAuth button,
// and a link to register. The page has its own Container maxWidth="sm".
export const Default: Story = {};

// OAuth error state: the URL carries ?error=github-no-verified-email, so the
// page renders the resolved OAuth error alert above the form fields.
export const WithOAuthError: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post('/api/auth/login', () =>
          HttpResponse.json(
            { id: 'usr_001', email: 'demo@mikrou.li', createdAt: '2026-01-15T10:30:00.000Z' },
            { status: 200 },
          ),
        ),
      ],
    },
  },
};
