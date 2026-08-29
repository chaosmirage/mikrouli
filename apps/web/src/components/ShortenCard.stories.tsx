import type { Meta, StoryObj } from '@storybook/react';
import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
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
// dashboard i18n namespace. Submitting runs against the global MSW handler
// for POST /api/urls and brings the result moment into this same card: the
// confirmation, the takeable short address with one-activation copy and its
// landed confirmation, and the QR block with both export formats.
export const Default: Story = {
  args: {
    namespace: 'dashboard',
  },
};

// Renders the card using the landing i18n namespace, which resolves the
// guestShortenPlaceholder / guestShortenButton labels for anonymous visitors.
// The register offer after the value is staged by the guest host around this
// card, so it is not part of the card itself.
export const LandingNamespace: Story = {
  args: {
    namespace: 'landing',
  },
};

// The refused entering: every POST /api/urls returns a validation problem, so
// one activation of the confirm stands the resolved failure statement with
// the act instead of a link.
export const RefusedEntering: Story = {
  args: {
    namespace: 'dashboard',
  },
  parameters: {
    msw: {
      handlers: [
        http.post(
          '/api/urls',
          () =>
            HttpResponse.json(
              {
                type: 'about:blank',
                title: 'Validation error',
                status: 422,
                errors: [
                  { field: 'url', message: 'must be a valid http(s) URL', rule: 'url' },
                ],
              },
              { status: 422 },
            ),
        ),
      ],
    },
  },
};
