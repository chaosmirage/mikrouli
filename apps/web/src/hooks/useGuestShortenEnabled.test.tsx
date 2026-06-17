import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { TestQueryClientProvider } from '../test/queryClient';
import { useGuestShortenEnabled } from './useGuestShortenEnabled';

// Drives the hook against a stubbed /config.js fetch. The hook is the ONLY
// consumer of the runtime-config channel; these tests pin its observable
// tri-state behavior: loading -> (enabled | disabled), with disabled as the
// fail-safe default on any error, malformed body, or absent field.

function stubConfigBody(body: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(body),
    }),
  );
}

function stubConfigError(): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
}

function renderFlag() {
  return renderHook(() => useGuestShortenEnabled(), {
    wrapper: ({ children }) => <TestQueryClientProvider>{children}</TestQueryClientProvider>,
  });
}

describe('useGuestShortenEnabled', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('is disabled when the channel is enabled=true', async () => {
    stubConfigBody('window.__MIKROULI_CONFIG__ = { guestShortenEnabled: true };\n');
    const { result } = renderFlag();
    await waitFor(() => expect(result.current).toBe('enabled'));
  });

  it('is disabled when the channel returns guestShortenEnabled=false', async () => {
    stubConfigBody('window.__MIKROULI_CONFIG__ = { guestShortenEnabled: false };\n');
    const { result } = renderFlag();
    await waitFor(() => expect(result.current).toBe('disabled'));
  });

  it('falls back to disabled on a malformed body (no strict equality)', async () => {
    stubConfigBody('window.__MIKROULI_CONFIG__ = {};\n');
    const { result } = renderFlag();
    await waitFor(() => expect(result.current).toBe('disabled'));
  });

  it('falls back to disabled on a fetch error (fail-safe)', async () => {
    stubConfigError();
    const { result } = renderFlag();
    await waitFor(() => expect(result.current).toBe('disabled'));
  });
});
