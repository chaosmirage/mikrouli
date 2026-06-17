import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  ThemeModeProvider,
  useThemeMode,
  THEME_MODE_STORAGE_KEY,
} from './theme-mode-context';
import type { ThemeMode } from './theme-mode-context';

// --- helpers --------------------------------------------------------------

const MATCH_DARK = '(prefers-color-scheme: dark)';

function makeMatchMedia(prefersDark: boolean) {
  const listeners = new Set<(e: { matches: boolean }) => void>();
  const mql = {
    matches: prefersDark,
    media: MATCH_DARK,
    onchange: null,
    addEventListener: (
      _type: string,
      l: (e: { matches: boolean }) => void,
    ) => listeners.add(l),
    removeEventListener: (
      _type: string,
      l: (e: { matches: boolean }) => void,
    ) => listeners.delete(l),
    addListener: (l: (e: { matches: boolean }) => void) => listeners.add(l),
    removeListener: (l: (e: { matches: boolean }) => void) => listeners.delete(l),
    dispatchChange: (matches: boolean) => {
      mql.matches = matches;
      listeners.forEach((l) => l({ matches }));
    },
  };
  return mql;
}

type MatchMediaFixture = ReturnType<typeof makeMatchMedia> & {
  dispatchChange: (m: boolean) => void;
};

function installMatchMedia(prefersDark: boolean): MatchMediaFixture {
  const fixture = makeMatchMedia(prefersDark) as MatchMediaFixture;
  vi.stubGlobal('matchMedia', () => fixture);
  return fixture;
}

function renderProvider() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ThemeModeProvider>{children}</ThemeModeProvider>
  );
  return renderHook(() => useThemeMode(), { wrapper });
}

// --- tests ----------------------------------------------------------------

describe('ThemeModeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('exposes mode / effectiveMode / setMode via the hook', () => {
    installMatchMedia(false);
    const { result } = renderProvider();
    expect(result.current).toSatisfy(
      (v: unknown) =>
        v !== null &&
        typeof v === 'object' &&
        'mode' in (v as object) &&
        'effectiveMode' in (v as object) &&
        'setMode' in (v as object),
    );
  });

  it('uses follow-system as the default when no localStorage value is present', () => {
    installMatchMedia(false);
    const { result } = renderProvider();
    expect(result.current.mode).toBe('follow-system');
  });

  it('resolves follow-system effective mode from the OS preference (dark)', () => {
    installMatchMedia(true);
    const { result } = renderProvider();
    expect(result.current.effectiveMode).toBe('dark');
  });

  it('resolves follow-system effective mode from the OS preference (light)', () => {
    installMatchMedia(false);
    const { result } = renderProvider();
    expect(result.current.effectiveMode).toBe('light');
  });

  it('honors an explicit persisted light/dark choice over the OS preference', () => {
    installMatchMedia(true);
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, 'light');
    const { result } = renderProvider();
    expect(result.current.mode).toBe('light');
    expect(result.current.effectiveMode).toBe('light');
  });

  it('falls back to follow-system when localStorage holds an unrecognized value', () => {
    installMatchMedia(false);
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, 'banana');
    const { result } = renderProvider();
    expect(result.current.mode).toBe('follow-system');
  });

  it('setMode updates the live state and persists to localStorage', () => {
    installMatchMedia(false);
    const { result } = renderProvider();
    act(() => result.current.setMode('dark'));
    expect(result.current.mode).toBe('dark');
    expect(result.current.effectiveMode).toBe('dark');
    expect(window.localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('dark');
  });

  it('tracks live OS changes while mode is follow-system', () => {
    const fixture = installMatchMedia(false);
    const { result } = renderProvider();
    expect(result.current.effectiveMode).toBe('light');
    act(() => fixture.dispatchChange(true));
    expect(result.current.effectiveMode).toBe('dark');
    act(() => fixture.dispatchChange(false));
    expect(result.current.effectiveMode).toBe('light');
  });

  it('does NOT track live OS changes when an explicit mode is set', () => {
    const fixture = installMatchMedia(false);
    const { result } = renderProvider();
    act(() => result.current.setMode('light'));
    act(() => fixture.dispatchChange(true));
    expect(result.current.effectiveMode).toBe('light');
  });

  it('resumes follow-system tracking when the user switches back', () => {
    const fixture = installMatchMedia(false);
    const { result } = renderProvider();
    act(() => result.current.setMode('light'));
    act(() => fixture.dispatchChange(true));
    expect(result.current.effectiveMode).toBe('light');
    act(() => result.current.setMode('follow-system'));
    expect(result.current.effectiveMode).toBe('dark');
  });
});

// Renderer smoke test: provider renders children.
describe('ThemeModeProvider (render)', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('renders its children', () => {
    installMatchMedia(false);
    const Child = () => <div data-testid="child">hi</div>;
    const { getByTestId } = render(
      <ThemeModeProvider>
        <Child />
      </ThemeModeProvider>,
    );
    expect(getByTestId('child')).toHaveTextContent('hi');
  });
});

// Compile-time check: every ThemeMode value is one of the three literals.
const _typeCheck: ThemeMode = 'follow-system';
void _typeCheck;
