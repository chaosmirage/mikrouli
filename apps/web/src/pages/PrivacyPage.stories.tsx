import type { Meta, StoryObj } from '@storybook/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import PrivacyPage from './PrivacyPage';
import { withStaticPage } from '../../.storybook/decorators';

// Seeds the router history so the return reach at the end of the reading has
// a real place to restore.
function reachedFrom(initialEntries: string[]) {
  return function decorator(Story: () => ReactNode) {
    return (
      <MemoryRouter initialEntries={initialEntries}>
        <Story />
      </MemoryRouter>
    );
  };
}

const meta: Meta<typeof PrivacyPage> = {
  title: 'Pages/PrivacyPage',
  component: PrivacyPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj<typeof PrivacyPage>;

// The privacy reading: the legal pair at the head, the text at the
// sustained-reading line height in the reading measure, the return at the
// end. Renders purely from the legal and common i18n namespaces.
export const Default: Story = { decorators: [withStaticPage] };

// The same reading reached from the dashboard, so the return at the end of
// the text restores the journey's place.
export const ReachedFromDashboard: Story = {
  decorators: [reachedFrom(['/dashboard', '/privacy'])],
};
