import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeModeContext } from '../theme-mode-context';
import type { ThemeModeContextValue } from '../theme-mode-context';
import ThemeModeSwitch from './ThemeModeSwitch';

function makeProviderValue(overrides: Partial<ThemeModeContextValue> = {}): ThemeModeContextValue {
  return {
    mode: 'follow-system',
    effectiveMode: 'light',
    setMode: vi.fn(),
    ...overrides,
  };
}

function renderSwitch(value: ThemeModeContextValue) {
  return render(
    <ThemeModeContext.Provider value={value}>
      <ThemeModeSwitch />
    </ThemeModeContext.Provider>,
  );
}

describe('ThemeModeSwitch', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the control with the canonical testid', () => {
    renderSwitch(makeProviderValue());
    expect(screen.getByTestId('theme-mode-switcher')).toBeInTheDocument();
  });

  it('reflects the current mode via its selected value', () => {
    const { container } = render(
      <ThemeModeContext.Provider value={makeProviderValue({ mode: 'dark' })}>
        <ThemeModeSwitch />
      </ThemeModeContext.Provider>,
    );
    // MUI Select exposes the current value on its hidden native input.
    const nativeInput = container.querySelector('input[aria-hidden="true"]') as HTMLInputElement;
    expect(nativeInput.value).toBe('dark');
  });

  it('reflects follow-system when that is the current mode', () => {
    const { container } = render(
      <ThemeModeContext.Provider value={makeProviderValue({ mode: 'follow-system' })}>
        <ThemeModeSwitch />
      </ThemeModeContext.Provider>,
    );
    const nativeInput = container.querySelector('input[aria-hidden="true"]') as HTMLInputElement;
    expect(nativeInput.value).toBe('follow-system');
  });

  // The full open-menu-and-click behavior is covered by the Playwright e2e
  // spec (theme.spec.ts), which operates the canonical option testids against
  // the real DOM. jsdom's portal handling is unreliable for the menu surface;
  // asserting it here would duplicate the e2e flakily.
});
