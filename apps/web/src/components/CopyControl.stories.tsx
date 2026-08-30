import type { Meta, StoryObj } from '@storybook/react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import CopyControl from './CopyControl';

const meta: Meta<typeof CopyControl> = {
  title: 'Components/CopyControl',
  component: CopyControl,
};

export default meta;

type Story = StoryObj<typeof CopyControl>;

// Stages a clipboard that refuses every write, so the failure statement is
// verifiable in the workbench without breaking the real browser clipboard.
// The injected own property is removed again when the story unmounts, which
// restores the navigator's real clipboard for the stories that follow.
function ClipboardRefusing({ Story }: { Story: () => ReactNode }) {
  useEffect(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new Error('clipboard unavailable')),
      },
    });
    return () => {
      Reflect.deleteProperty(navigator, 'clipboard');
    };
  }, []);
  return <Story />;
}

// The control before any take: one icon-only button with its accessible name.
export const BeforeTake: Story = {
  args: {
    value: 'https://mikrou.li/GYa6kx',
  },
};

// The take: click the control — the exact value reaches the real clipboard of
// the Storybook browser and the landed confirmation floats above the control.
export const AfterTake: Story = {
  args: {
    value: 'https://mikrou.li/GYa6kx',
  },
};

// The refused take: the clipboard refuses every write, so one activation
// floats the failure statement above the control instead of a silent no-op.
export const ClipboardUnavailable: Story = {
  decorators: [(Story: () => ReactNode) => <ClipboardRefusing Story={Story} />],
  args: {
    value: 'https://mikrou.li/GYa6kx',
  },
};

// The named take: where a surface states the act as a word, the word stands in
// the accent ink at the meta scale instead of the glyph — the act itself is the
// one saturated element on a calm surface.
export const NamedByWord: Story = {
  args: {
    value: 'curl -X POST https://mikrou.li/api/mcp',
    testId: 'copy-mcp-call',
    label: 'copy',
  },
};
