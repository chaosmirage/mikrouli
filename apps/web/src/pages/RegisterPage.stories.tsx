import type { Meta, StoryObj } from '@storybook/react';
import { http, HttpResponse } from 'msw';
import RegisterPage from './RegisterPage';
import { withGuestPage } from '../../.storybook/decorators';

const meta: Meta<typeof RegisterPage> = {
  title: 'Pages/RegisterPage',
  component: RegisterPage,
  decorators: [withGuestPage],
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj<typeof RegisterPage>;

// Default state: empty registration form with email/password fields and the
// GitHub OAuth button. The page has its own Container maxWidth="sm".
export const Default: Story = {};

// Validation error state: the registration endpoint rejects with a 422 so the
// page surfaces the validation error alert.
export const WithValidationError: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post('/api/auth/register', () =>
          HttpResponse.json({ title: 'Email already registered', status: 422 }, { status: 422 }),
        ),
      ],
    },
  },
};
