import type { Meta, StoryObj } from '@storybook/react';
import { http, HttpResponse } from 'msw';
import LandingPage from './LandingPage';
import { withGuestPage } from '../../.storybook/decorators';

const meta: Meta<typeof LandingPage> = {
  title: 'Pages/LandingPage',
  component: LandingPage,
  decorators: [withGuestPage],
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj<typeof LandingPage>;

// Guest view: the AuthProvider session probe resolves to null (logged out) and
// the guest-shorten feature flag is enabled. The hero, guest shorten card,
// features, agent section, and bottom CTA all render. The page renders full
// width (outside ContainedLayout) so no container decorator is composed.
export const Default: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/auth/me', () => new HttpResponse(null, { status: 401 })),
        http.get('/config.js', () =>
          new HttpResponse('window.__MIKROULI_CONFIG__ = { guestShortenEnabled: true };\n', {
            headers: { 'Content-Type': 'application/javascript' },
          }),
        ),
      ],
    },
  },
};

// Authenticated view: the session probe returns the demo user. The guest
// shorten section is hidden; the hero CTAs remain (they are always visible).
export const Authenticated: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/auth/me', () =>
          HttpResponse.json(
            { id: 'usr_001', email: 'demo@mikrou.li', createdAt: '2026-01-15T10:30:00.000Z' },
            { status: 200 },
          ),
        ),
        http.get('/config.js', () =>
          new HttpResponse('window.__MIKROULI_CONFIG__ = { guestShortenEnabled: true };\n', {
            headers: { 'Content-Type': 'application/javascript' },
          }),
        ),
      ],
    },
  },
};
