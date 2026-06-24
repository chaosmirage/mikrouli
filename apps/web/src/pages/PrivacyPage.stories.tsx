import type { Meta, StoryObj } from '@storybook/react';
import PrivacyPage from './PrivacyPage';
import { withStaticPage } from '../../.storybook/decorators';

const meta: Meta<typeof PrivacyPage> = {
  title: 'Pages/PrivacyPage',
  component: PrivacyPage,
  decorators: [withStaticPage],
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj<typeof PrivacyPage>;

// Static legal page. The page has its own Container maxWidth="md" and renders
// purely from the i18n privacy namespace; no providers or MSW handlers needed.
export const Default: Story = {};
