import type { Meta, StoryObj } from '@storybook/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';
import { withGuestPage } from '../../.storybook/decorators';

// A router entry so a story can open the page with the URL it needs (the
// federated failure arrives as ?error=... on the real location).
type RouteEntry = string | { pathname: string; search?: string };

function withRouterAt(entry: RouteEntry) {
  return function RouterAt(Story: () => ReactNode): React.JSX.Element {
    return (
      <MemoryRouter initialEntries={[entry]}>
        <Story />
      </MemoryRouter>
    );
  };
}

const meta: Meta<typeof LoginPage> = {
  title: 'Pages/LoginPage',
  component: LoginPage,
  decorators: [withGuestPage],
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj<typeof LoginPage>;

// Default state: the entering column with the federated path staged first and
// the credentials path (email, password, one confirm) below it. The page
// manages its own narrow centered column (Container maxWidth="sm").
export const Default: Story = {};

// Federated failure state: the URL carries ?error=github-no-verified-email,
// so the resolved OAuth failure statement stands with the federated path.
export const WithOAuthError: Story = {
  decorators: [withRouterAt('/login?error=github-no-verified-email')],
};

// The same surface with the generic federated failure (unknown error slug).
export const WithOAuthFallback: Story = {
  decorators: [withRouterAt('/login?error=unknown-slug')],
};
