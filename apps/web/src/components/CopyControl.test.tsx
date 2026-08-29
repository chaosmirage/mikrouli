import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import CopyControl from './CopyControl';
import { createAppTheme } from '../theme';

// jsdom ships no Async Clipboard API, so each test installs a controllable
// clipboard and keeps the list of texts that actually reached it.
function installClipboard(mode: 'works' | 'missing'): string[] {
  const taken: string[] = [];
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value:
      mode === 'missing'
        ? undefined
        : {
            writeText: (text: string) => {
              taken.push(text);
              return Promise.resolve();
            },
          },
  });
  return taken;
}

afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: undefined,
  });
});

function renderControl(props?: { value?: string; testId?: string }) {
  render(
    <ThemeProvider theme={createAppTheme('light')}>
      <CopyControl value={props?.value ?? 'https://mikrou.li/GYa6kx'} testId={props?.testId} />
    </ThemeProvider>,
  );
}

// Drives the taking control at the user-closest seam: one activation of the
// control, the landed confirmation observed beside it in the same glance.
describe('CopyControl', () => {
  it('renders one take control with an accessible name', () => {
    installClipboard('works');
    renderControl();

    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it('shows the landed confirmation beside the control after one activation', async () => {
    installClipboard('works');
    renderControl();

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    // The confirmation arrives once the clipboard write resolves.
    expect(await screen.findByText('Copied')).toBeInTheDocument();
    // The control stays reachable: one activation took the text; the moment
    // persists.
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it('lands exactly the value it was given', () => {
    const taken = installClipboard('works');
    renderControl({ value: 'https://mikrou.li/def456' });

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(taken).toEqual(['https://mikrou.li/def456']);
  });

  it('states the failure when the clipboard is unavailable', () => {
    installClipboard('missing');
    renderControl();

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(
      screen.getByText('Copying is not available in this browser'),
    ).toBeInTheDocument();
  });

  it('carries a per-instance harness address for the control and its confirmation', async () => {
    installClipboard('works');
    renderControl({ testId: 'copy-link-def456' });

    fireEvent.click(screen.getByTestId('copy-link-def456'));

    expect(await screen.findByTestId('copy-link-def456-landed')).toBeInTheDocument();
  });
});
