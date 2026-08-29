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

// Guest view with the act present: the AuthProvider session probe resolves to
// null (logged out) and the guest-shorten feature flag is enabled. The
// statement, the guest shorten act, and the claims band render in arrival
// order. The page renders full width (outside ContainedLayout), so no
// container decorator is composed.
export const GuestWithAct: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/auth/me', () => new HttpResponse(null, { status: 401 })),
        http.get(
          '/config.js',
          () =>
            new HttpResponse('window.__MIKROULI_CONFIG__ = { guestShortenEnabled: true };\n', {
              headers: { 'Content-Type': 'application/javascript' },
            }),
        ),
      ],
    },
  },
};

// Guest view with the act absent: the flag is off, so the landing stands
// complete on statement and claims alone — the fail-safe reading.
export const GuestWithoutAct: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/auth/me', () => new HttpResponse(null, { status: 401 })),
        http.get(
          '/config.js',
          () =>
            new HttpResponse('window.__MIKROULI_CONFIG__ = { guestShortenEnabled: false };\n', {
              headers: { 'Content-Type': 'application/javascript' },
            }),
        ),
      ],
    },
  },
};

// Authenticated view: the session probe returns the demo user, so the guest
// act is hidden; the statement and the claims band remain.
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
        http.get(
          '/config.js',
          () =>
            new HttpResponse('window.__MIKROULI_CONFIG__ = { guestShortenEnabled: true };\n', {
              headers: { 'Content-Type': 'application/javascript' },
            }),
        ),
      ],
    },
  },
};
