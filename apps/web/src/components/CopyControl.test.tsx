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

function renderControl(props?: { value?: string; testId?: string; label?: string }) {
  return render(
    <ThemeProvider theme={createAppTheme('light')}>
      <CopyControl
        value={props?.value ?? 'https://mikrou.li/GYa6kx'}
        testId={props?.testId}
        label={props?.label}
      />
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

    expect(screen.getByText('Copying is not available in this browser')).toBeInTheDocument();
  });

  it('carries a per-instance harness address for the control and its confirmation', async () => {
    installClipboard('works');
    renderControl({ testId: 'copy-link-def456' });

    fireEvent.click(screen.getByTestId('copy-link-def456'));

    expect(await screen.findByTestId('copy-link-def456-landed')).toBeInTheDocument();
  });

  it('floats the confirmation over the control: absolute when landed, no in-flow matter when idle', async () => {
    installClipboard('works');
    renderControl({ testId: 'copy-link-abc' });

    // Idle: nothing of the confirmation renders at all. The control's flow
    // carries only the take button, so the control's box is the button's
    // alone — the cluster the control stands in reads as one tight group,
    // with the icon a single cluster gap from its siblings.
    expect(screen.queryByTestId('copy-link-abc-confirmation')).not.toBeInTheDocument();
    const controlRoot = screen.getByTestId('copy-link-abc').parentElement;
    expect(controlRoot?.childElementCount).toBe(1);
    expect(controlRoot?.textContent).toBe('');

    fireEvent.click(screen.getByTestId('copy-link-abc'));

    // Landed: the confirmation is a floating statement anchored above the
    // control — position absolute, so it occupies no flow space by
    // construction, and pointer-events none, so it can never cover a
    // sibling control's click target while it stands.
    const landed = await screen.findByTestId('copy-link-abc-landed');
    expect(getComputedStyle(landed).position).toBe('absolute');
    expect(getComputedStyle(landed).pointerEvents).toBe('none');
  });

  it('floats the refused take statement the same way: absolute, out of the flow', () => {
    installClipboard('missing');
    renderControl({ testId: 'copy-link-abc' });

    fireEvent.click(screen.getByTestId('copy-link-abc'));

    const refused = screen.getByTestId('copy-link-abc-failed');
    expect(getComputedStyle(refused).position).toBe('absolute');
    expect(getComputedStyle(refused).pointerEvents).toBe('none');
  });

  // The named take: where a surface states the act as a word, the word is the
  // control -- no icon glyph beside it, and the word itself carries the accent.
  it('states the act as the given word instead of the icon glyph', () => {
    installClipboard('works');
    const { container } = renderControl({ label: 'copy', testId: 'copy-example' });

    const take = screen.getByRole('button', { name: 'copy' });
    expect(take).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('carries the named take in the accent ink', () => {
    installClipboard('works');
    renderControl({ label: 'copy', testId: 'copy-example' });

    const take = screen.getByRole('button', { name: 'copy' });
    const accent = createAppTheme('light').palette.accent.solid;
    const value = accent.replace('#', '');
    const red = parseInt(value.slice(0, 2), 16);
    const green = parseInt(value.slice(2, 4), 16);
    const blue = parseInt(value.slice(4, 6), 16);
    expect(getComputedStyle(take).color).toBe(`rgb(${red}, ${green}, ${blue})`);
  });

  it('one activation of the named take still lands exactly the value', async () => {
    const taken = installClipboard('works');
    renderControl({ label: 'copy', testId: 'copy-example', value: 'https://mikrou.li/abc123' });

    fireEvent.click(screen.getByRole('button', { name: 'copy' }));

    expect(taken).toEqual(['https://mikrou.li/abc123']);
    expect(await screen.findByTestId('copy-example-landed')).toBeInTheDocument();
  });
});
