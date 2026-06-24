import type { Meta, StoryObj } from '@storybook/react';
import TermsPage from './TermsPage';
import { withStaticPage } from '../../.storybook/decorators';

const meta: Meta<typeof TermsPage> = {
  title: 'Pages/TermsPage',
  component: TermsPage,
  decorators: [withStaticPage],
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj<typeof TermsPage>;

// Static legal page. The page has its own Container maxWidth="md" and renders
// purely from the i18n terms namespace; no providers or MSW handlers needed.
export const Default: Story = {};
