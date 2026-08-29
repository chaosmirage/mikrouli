import type { Meta, StoryObj } from '@storybook/react';
import ConnectPage from './ConnectPage';
import { withStaticPage } from '../../.storybook/decorators';

const meta: Meta<typeof ConnectPage> = {
  title: 'Pages/ConnectPage',
  component: ConnectPage,
  decorators: [withStaticPage],
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj<typeof ConnectPage>;

// Renders the full connect page inside the reading measure: the connection
// statement, the credential's authorization terms (obtaining, header, key
// format), and the machine terms with the takeable example calls — the direct
// REST call and the harness-add command. The page has its own Container
// maxWidth="sm" so no container decorator is composed.
export const Default: Story = {};
