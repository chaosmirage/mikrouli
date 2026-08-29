import type { Meta, StoryObj } from '@storybook/react';
import StatementBand from './StatementBand';

const meta: Meta<typeof StatementBand> = {
  title: 'Components/StatementBand',
  component: StatementBand,
  args: {
    state: { kind: 'underway' },
  },
};

export default meta;

type Story = StoryObj<typeof StatementBand>;

// The four aftermath registers. Switch the locale and theme toolbars to check
// each statement reads completely in en/de/el and in both modes.
export const Underway: Story = {
  args: { state: { kind: 'underway' } },
};

export const Landed: Story = {
  args: { state: { kind: 'landed' } },
};

export const Empty: Story = {
  args: { state: { kind: 'empty' } },
};

// A surface stating its own empty register instead of the generic one, as the
// stats surface does.
export const EmptyWithHostKey: Story = {
  args: { state: { kind: 'empty' }, emptyKey: 'stats:noData' },
};

export const Failure: Story = {
  args: {
    state: { kind: 'failure', cause: new Error('url must be a valid URL') },
  },
};
