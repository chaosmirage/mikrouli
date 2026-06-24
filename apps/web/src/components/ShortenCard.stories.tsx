import type { Meta, StoryObj } from '@storybook/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ShortenCard from './ShortenCard';

// ShortenCard is actor-agnostic: it needs Router + QueryClient but NOT Auth.
// This single inline decorator combines both to avoid composing multiple
// individual decorators in the `decorators` array.
function withShortenCardProviders(
  Story: () => ReactNode,
): React.JSX.Element {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return (
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <Story />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

const meta: Meta<typeof ShortenCard> = {
  title: 'Components/ShortenCard',
  component: ShortenCard,
  decorators: [withShortenCardProviders],
};

export default meta;

type Story = StoryObj<typeof ShortenCard>;

// Renders the card in its idle (empty, not submitted) state using the
// dashboard i18n namespace. The global MSW handler for POST /api/urls covers
// the submit path; this story needs no per-story handlers.
export const Default: Story = {
  args: {
    namespace: 'dashboard',
  },
};

// Renders the card using the landing i18n namespace, which resolves the
// guestShortenPlaceholder / guestShortenButton labels for anonymous visitors.
export const LandingNamespace: Story = {
  args: {
    namespace: 'landing',
  },
};
