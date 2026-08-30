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

// Renders the full connect surface inside the content zone: the connection
// statement, the credential's terms and the machine's terms as labeled rows
// in the technical register, and the one takeable example call.
export const Default: Story = {};
