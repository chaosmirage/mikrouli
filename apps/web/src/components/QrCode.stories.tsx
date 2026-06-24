import type { Meta, StoryObj } from '@storybook/react';
import QrCode from './QrCode';

const meta: Meta<typeof QrCode> = {
  title: 'Components/QrCode',
  component: QrCode,
  args: {
    value: 'https://mikrou.li/abc123',
    size: 160,
  },
};

export default meta;

type Story = StoryObj<typeof QrCode>;

// Renders the QR at the default size (160 px) for the canonical example short
// URL. The "Download PNG" button is wired to the real rasterization path.
export const Default: Story = {};

// Renders the QR at a larger size (240 px) — used when the host layout gives
// the QR more breathing room (e.g., a dedicated share dialog).
export const CustomSize: Story = {
  args: {
    size: 240,
  },
};
