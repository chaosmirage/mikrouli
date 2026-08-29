import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCopyToClipboard } from './useCopyToClipboard';

// jsdom ships no Async Clipboard API, so each test installs a controllable
// clipboard and keeps the list of texts that actually reached it. Assertions
// read that list — the user-observable landing — never call bookkeeping.
function installClipboard(mode: 'works' | 'rejects' | 'missing'): string[] {
  const taken: string[] = [];
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value:
      mode === 'missing'
        ? undefined
        : {
            writeText: (text: string) => {
              taken.push(text);
              return mode === 'rejects'
                ? Promise.reject(new Error('clipboard refused the write'))
                : Promise.resolve();
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

// Drives the hook at its consumer seam: take a text, observe how the take
// resolved. A take must always resolve to a stated outcome — landing, or a
// failure that the UI can stand beside the control. Never a silent no-op.
describe('useCopyToClipboard', () => {
  it('starts with no outcome before anything is taken', () => {
    installClipboard('works');
    const { result } = renderHook(() => useCopyToClipboard());
    expect(result.current.outcome.status).toBe('idle');
  });

  it('lands the taken text on the clipboard', async () => {
    const taken = installClipboard('works');
    const { result } = renderHook(() => useCopyToClipboard());

    result.current.copy('https://mikrou.li/GYa6kx');

    await waitFor(() => expect(result.current.outcome.status).toBe('landed'));
    expect(taken).toEqual(['https://mikrou.li/GYa6kx']);
  });

  it('states the failure when the clipboard refuses the write', async () => {
    installClipboard('rejects');
    const { result } = renderHook(() => useCopyToClipboard());

    result.current.copy('https://mikrou.li/GYa6kx');

    await waitFor(() => expect(result.current.outcome.status).toBe('failed'));
  });

  it('states the failure instead of a silent no-op when no clipboard exists', async () => {
    installClipboard('missing');
    const { result } = renderHook(() => useCopyToClipboard());

    result.current.copy('https://mikrou.li/GYa6kx');

    await waitFor(() => expect(result.current.outcome.status).toBe('failed'));
  });
});
