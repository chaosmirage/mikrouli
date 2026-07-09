import type { Meta, StoryObj } from '@storybook/react';
import EditLinkDialog from './EditLinkDialog';

// Module-scope no-op handlers keep story args stable across renders without
// allocating new function references in JSX attributes.
const noop = () => undefined;

const meta: Meta<typeof EditLinkDialog> = {
  title: 'Components/EditLinkDialog',
  component: EditLinkDialog,
  args: {
    open: true,
    slug: 'aB3xY9',
    currentUrl: 'https://example.com/current-destination',
    onConfirm: noop,
    onCancel: noop,
  },
};

export default meta;

type Story = StoryObj<typeof EditLinkDialog>;

// Default open state, pre-filled with the link's current destination.
export const Default: Story = {};

// Confirm is disabled while the PATCH request is in flight.
export const Loading: Story = {
  args: {
    loading: true,
  },
};

// Server-side validation rejected the submitted destination; the message
// replaces the helper text and marks the field as errored.
export const WithError: Story = {
  args: {
    error:
      'url must be a public http(s) URL (private, loopback, and link-local addresses are not allowed)',
  },
};
