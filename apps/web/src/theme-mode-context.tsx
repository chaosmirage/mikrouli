// Context, provider, and hook are intentionally co-located in one module.
/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { PaletteMode } from '@mui/material';

// --- Data structures -----------------------------------------------------

/** The user's intent: an explicit choice, or delegation to the OS. */
export type ThemeMode = 'light' | 'dark' | 'follow-system';

/** The resolved palette mode actually fed to createAppTheme. */
export type { PaletteMode };

/** The localStorage entry shared with the inline head script (anti-flash). */
export const THEME_MODE_STORAGE_KEY = 'mikrouli.themeMode';

const VALID_MODES: readonly ThemeMode[] = ['light', 'dark', 'follow-system'];
const OS_DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

// --- Internal helpers (kept module-private; only the hook/provider use them)

function isValidMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'follow-system';
}

/** Read the persisted choice. Returns null when absent or unrecognized (the
 *  cascade then falls through to the OS preference). Fail-safe by construction. */
function readPersistedMode(): ThemeMode | null {
  try {
    const raw = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
    return isValidMode(raw) ? raw : null;
  } catch {
    // Private mode / disabled storage — treat as no stored choice.
    return null;
  }
}

function persistMode(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
  } catch {
    // Swallow: persistence is a best-effort enhancement, never a hard failure.
  }
}

/** Read the OS preference. Returns false if matchMedia is absent (fail-safe). */
function readOsPreference(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(OS_DARK_MEDIA_QUERY).matches;
}

/** Pure projection: ThemeMode + OS preference -> concrete PaletteMode. */
function resolveEffectiveMode(mode: ThemeMode, prefersDark: boolean): PaletteMode {
  if (mode === 'follow-system') return prefersDark ? 'dark' : 'light';
  return mode;
}

// --- Public types --------------------------------------------------------

export interface ThemeModeContextValue {
  mode: ThemeMode;
  effectiveMode: PaletteMode;
  setMode: (next: ThemeMode) => void;
}

// --- Context, provider, hook ---------------------------------------------

export const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export function ThemeModeProvider({ children }: PropsWithChildren) {
  // Resolve the initial state synchronously in the useState initializer so the
  // first React render is already in the correct mode (no flash from React).
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const persisted = readPersistedMode();
    return persisted ?? 'follow-system';
  });

  // OS preference is real state: we re-render when it changes (live tracking
  // under follow-system). Lazy initializer reads once on mount.
  const [prefersDark, setPrefersDark] = useState<boolean>(() => readOsPreference());

  // Subscribe to live OS changes. The listener stays active for the lifetime of
  // the provider — resolveEffectiveMode only consults prefersDark when mode is
  // 'follow-system', so the subscription cost is the same regardless of mode
  // and avoids tearing the subscription down/up on every mode toggle.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia(OS_DARK_MEDIA_QUERY);
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    // Use addEventListener (modern) with addListener fallback for old Safari.
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  // effectiveMode is a pure derivation from the current state — compute it
  // during render rather than mirroring it into a second useState (avoids the
  // duplicated-state-synced-via-effect anti-pattern).
  const effectiveMode = resolveEffectiveMode(mode, prefersDark);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    persistMode(next);
  }, []);

  const value = useMemo<ThemeModeContextValue>(
    () => ({ mode, effectiveMode, setMode }),
    [mode, effectiveMode, setMode],
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode(): ThemeModeContextValue {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeModeProvider');
  return ctx;
}

// Keep VALID_MODES referenced: it documents the closed enum that the inline
// head script must validate against (the script cannot import this module).
void VALID_MODES;
