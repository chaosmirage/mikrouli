import { useState, useCallback } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import SettingsPanel from './SettingsPanel';
import { withThemeMode } from '../../.storybook/decorators';

const meta: Meta<typeof SettingsPanel> = {
  title: 'Components/SettingsPanel',
  component: SettingsPanel,
  decorators: [withThemeMode],
};

export default meta;

type Story = StoryObj<typeof SettingsPanel>;

// The shell wires the panel as a controlled dialog opened by the shell band's
// color-mode and language reaches. The host mirrors that wiring so the panel is
// live in the workbench: reaches open it, the closing lifts it.
function PanelHost({ initiallyOpen }: { initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const openPair = useCallback(() => setOpen(true), []);
  const closePair = useCallback(() => setOpen(false), []);
  return (
    <Stack spacing={2} alignItems="flex-start">
      <Button variant="outlined" onClick={openPair}>
        Open the setting pair
      </Button>
      <p>The occupied place stands beneath the veil, kept visible while the pair is open.</p>
      <SettingsPanel open={open} onClose={closePair} />
    </Stack>
  );
}

// The pair standing open over the page: both selections visible, the current
// choice marked in each. Selecting a mode or language re-renders the whole
// workbench in the chosen setting (withThemeMode provides the live mode store;
// the preview's locale toolbar drives the language).
export const Open: Story = {
  render: () => <PanelHost initiallyOpen />,
};

// The pair closed: the place beneath reads as the standing surface, one reach
// away from reopening.
export const Closed: Story = {
  render: () => <PanelHost initiallyOpen={false} />,
};
