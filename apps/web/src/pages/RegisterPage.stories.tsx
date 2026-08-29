import type { Meta, StoryObj } from '@storybook/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from './RegisterPage';
import { withGuestPage } from '../../.storybook/decorators';

// A router entry so a story can open the page with the arrival it needs —
// the register offer's accept reach carries router state, direct arrivals
// carry none.
type RouteEntry = string | { pathname: string; state?: Record<string, unknown> };

function withRouterAt(entry: RouteEntry) {
  return function RouterAt(Story: () => ReactNode): React.JSX.Element {
    return (
      <MemoryRouter initialEntries={[entry]}>
        <Story />
      </MemoryRouter>
    );
  };
}

const meta: Meta<typeof RegisterPage> = {
  title: 'Pages/RegisterPage',
  component: RegisterPage,
  decorators: [withGuestPage],
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj<typeof RegisterPage>;

// Default state: the entering column on a direct arrival — statement, the
// federated path staged first, the credentials path (email, password with its
// rule hint, one confirm) below it. No stake line on a direct arrival.
export const Default: Story = {};

// Arrival from the accepted register offer: the router state carries the
// offer, so the statement restates the kept-link stake in one line.
export const FromRegisterOffer: Story = {
  decorators: [withRouterAt({ pathname: '/register', state: { fromRegisterOffer: true } })],
};

// Federated failure state: the URL carries a GitHub error slug, resolved
// through the closed dictionary to a standing statement with the federated
// path.
export const WithOAuthError: Story = {
  decorators: [withRouterAt('/register?error=github-no-verified-email')],
};
