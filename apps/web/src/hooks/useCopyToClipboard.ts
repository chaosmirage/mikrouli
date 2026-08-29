import { useCallback, useState } from 'react';

/// The observed outcome of one take, discriminated on `status` so impossible
/// combinations (landed and failed at once) cannot exist.
export type CopyOutcome =
  | { status: 'idle' }
  | { status: 'landed' }
  | { status: 'failed' };

export interface UseCopyToClipboard {
  /// How the most recent take resolved, so the caller can stand the matching
  /// statement beside its control.
  outcome: CopyOutcome;
  /// Takes the exact text onto the clipboard. Fire-and-forget by design: the
  /// outcome, not a returned promise, is how the take reports itself.
  copy: (text: string) => void;
}

/**
 * Puts text onto the system clipboard and reports how the take resolved.
 *
 * A take must never be a silent no-op: when the clipboard is unavailable or
 * refuses the write, the outcome states the failure, so every taking can show
 * a resolved statement instead of leaving the user guessing whether anything
 * happened. This hook is the single clipboard mechanism in the web app — no
 * component writes to `navigator.clipboard` directly.
 */
export function useCopyToClipboard(): UseCopyToClipboard {
  const [outcome, setOutcome] = useState<CopyOutcome>({ status: 'idle' });

  const copy = useCallback((text: string) => {
    const clipboard = navigator.clipboard;
    if (!clipboard?.writeText) {
      setOutcome({ status: 'failed' });
      return;
    }
    void clipboard
      .writeText(text)
      .then(() => setOutcome({ status: 'landed' }))
      .catch(() => setOutcome({ status: 'failed' }));
  }, []);

  return { outcome, copy };
}
