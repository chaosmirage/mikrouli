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

// Renders the full connect page with the API key prerequisite, REST API, and
// MCP sections including the Claude Code wiring command. The page has its own
// Container maxWidth="md" so no container decorator is composed.
export const Default: Story = {};
