import type { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';
import ConnectPage from './ConnectPage';

const meta: Meta<typeof ConnectPage> = {
  title: 'Pages/ConnectPage',
  component: ConnectPage,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof ConnectPage>;

// Renders the full connect page with the API key prerequisite, REST API,
// and MCP sections including the Claude Code wiring command.
export const Default: Story = {};
