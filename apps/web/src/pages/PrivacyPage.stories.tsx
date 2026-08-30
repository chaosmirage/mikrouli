import type { Meta, StoryObj } from '@storybook/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import PrivacyPage from './PrivacyPage';
import { createAppTheme } from '../theme';
import { withStaticPage } from '../../.storybook/decorators';

// The reading's whole design is its ink relation, so the dark realization is
// a primary variant of the same surface, not a second theme.
function darkReading(Story: () => ReactNode): React.JSX.Element {
  const theme = createAppTheme('dark');
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    </ThemeProvider>
  );
}

const meta: Meta<typeof PrivacyPage> = {
  title: 'Pages/PrivacyPage',
  component: PrivacyPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj<typeof PrivacyPage>;

// The privacy reading: the same family as the terms text — the legal pair at
// the head with the hairline closing it across the zone, the text at the
// sustained-reading line height inside the reading measure. Renders purely
// from the legal and common namespaces.
export const Default: Story = { decorators: [withStaticPage] };

// The same reading in the dark realization of the same ink ladder.
export const DarkReading: Story = { decorators: [darkReading] };
