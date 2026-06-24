import type { Meta, StoryObj } from '@storybook/react';
import ThemeModeSwitch from './ThemeModeSwitch';
import { withThemeMode } from '../../.storybook/decorators';

const meta: Meta<typeof ThemeModeSwitch> = {
  title: 'Components/ThemeModeSwitch',
  component: ThemeModeSwitch,
  decorators: [withThemeMode],
};

export default meta;

type Story = StoryObj<typeof ThemeModeSwitch>;

// Renders the three-way mode selector. withThemeMode provides the full
// ThemeModeProvider > ThemedInner(ThemeProvider) chain, so the switch is live:
// selecting light/dark/follow-system updates the effective palette and the
// surrounding story re-renders in the resolved mode.
export const Default: Story = {};
