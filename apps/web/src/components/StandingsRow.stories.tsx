import type { Meta, StoryObj } from '@storybook/react';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import BarChartIcon from '@mui/icons-material/BarChart';
import StandingsRow from './StandingsRow';

const meta: Meta<typeof StandingsRow> = {
  title: 'Components/StandingsRow',
  component: StandingsRow,
};

export default meta;

type Story = StoryObj<typeof StandingsRow>;

// A dashboard-shaped row: the takeable short link as identity, the
// destination and the created/expiry standings beside it, act reaches at the
// row's end.
export const LinkRow: Story = {
  args: {
    rowTestId: 'link-row-example',
    identity: <Typography variant="technical">s.io/aB3xY9</Typography>,
    standings: [
      { label: 'Destination', value: 'https://example.com/a-very-long-destination' },
      { label: 'Created', value: 'Jan 5, 2024', testId: 'created-example' },
      { label: 'Expires', value: '—' },
    ],
    acts: (
      <>
        <IconButton size="small" aria-label="Copy">
          <ContentCopyIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" aria-label="Stats">
          <BarChartIcon fontSize="small" />
        </IconButton>
      </>
    ),
  },
};

// A breakdown-shaped row: no identity matter, one ranked label and its
// comparable value — the shape the stats and capability surfaces reuse.
export const RankedRow: Story = {
  args: {
    standings: [
      { label: 'Germany', value: '1,204' },
      { label: 'Share', value: '62%' },
    ],
  },
};

// The narrow-width arrangement: the standings wrap into a cluster under the
// identity, grouping preserved, only the arrangement changed.
export const WrappedRow: Story = {
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  args: {
    identity: <Typography variant="technical">s.io/aB3xY9</Typography>,
    standings: [
      { label: 'Destination', value: 'https://example.com/a-very-long-destination' },
      { label: 'Created', value: 'Jan 5, 2024' },
      { label: 'Expires', value: 'Feb 5, 2025' },
    ],
  },
};
