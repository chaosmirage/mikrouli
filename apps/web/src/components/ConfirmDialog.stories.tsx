import type { Meta, StoryObj } from '@storybook/react';
import ConfirmDialog from './ConfirmDialog';

// Module-scope no-op handlers keep story args stable across renders without
// allocating new function references in JSX attributes.
const noop = () => undefined;

const meta: Meta<typeof ConfirmDialog> = {
  title: 'Components/ConfirmDialog',
  component: ConfirmDialog,
  args: {
    open: true,
    title: 'Delete link',
    description: 'This action cannot be undone.',
    confirmLabel: 'Delete',
    onConfirm: noop,
    onCancel: noop,
  },
};

export default meta;

type Story = StoryObj<typeof ConfirmDialog>;

// Renders the dialog in its default open state. The Cancel button label comes
// from the real translation table (t('cancel') in the 'common' namespace) and
// switches when the toolbar locale changes.
export const Default: Story = {};

// Renders the dialog while an async operation is in progress; the confirm
// button is disabled so the user cannot submit twice.
export const Loading: Story = {
  args: {
    loading: true,
  },
};
