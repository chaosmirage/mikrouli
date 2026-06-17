# 0017. Dark/Light Theme with Anti-Flash Cascade

## Status

Accepted

## Context

The web app originally shipped a single hard-coded light MUI theme built once at
module load (`export const theme = createTheme({ ... })` in `apps/web/src/theme.ts`).
Component overrides referenced raw hex literals directly (e.g.
`backgroundColor: NAVY`), so every override was structurally bound to the light
palette. Supporting a dark mode — or any user-chosen visual mode — required
rethinking how the palette is constructed and how overrides read their colors.

Users expect a modern web app to offer at least three things:

1. An explicit light/dark toggle.
2. Automatic follow-system behavior that respects the OS `prefers-color-scheme`
   setting and tracks live OS changes without a page reload.
3. No flash of the wrong theme on first paint — the very first pixels the
   browser draws must already be in the user's chosen mode, before React mounts.

The third requirement is the hardest: React boots asynchronously after the
HTML document loads. If the theme is decided only inside React, the browser
shows the default (light) background for a frame, then switches — a visible
flash for dark-mode users.

## Decision

Adopt a **three-way theme mode** (`light` | `dark` | `follow-system`) driven by
a React context (`ThemeModeContext`) that resolves to a concrete MUI
`PaletteMode`, paired with an **inline anti-flash script** in
`apps/web/index.html` that sets the background color before React loads.

### Theme factory with palette-token-based overrides

`createAppTheme(mode: PaletteMode)` (`apps/web/src/theme.ts`) replaces the
single pre-built `theme` export as the canonical entry point. It calls
`paletteFor(mode)` to select between the light and dark palettes (both owned
entirely in `theme.ts`), then layers a single `componentsFor(t)` overrides block
that reads colors from **resolved palette tokens** (`t.palette.background.default`,
`t.palette.text.primary`, `t.palette.divider`, etc.) rather than raw hex
literals. One overrides block therefore serves both modes: a mode switch flows
through `paletteFor` and the overrides adapt automatically.

Dark palette accents are tuned so primary, secondary, and warning tones keep
contrast >= 3.0:1 against the dark background (`#121212`), asserted by unit
tests in `apps/web/src/theme.test.ts`. The light palette is the unchanged
design language.

A deprecated `export const theme = createAppTheme('light')` bridge is kept for
not-yet-migrated consumers; the intent is to remove it once every caller uses
the factory directly.

### ThemeModeContext: mode, effective mode, and live OS tracking

`ThemeModeProvider` (`apps/web/src/theme-mode-context.tsx`) owns three pieces
of state:

- **mode**: the user's intent — `light`, `dark`, or `follow-system`. Read
  synchronously from `localStorage['mikrouli.themeMode']` in the `useState`
  initializer so the first React render is already correct. Falls back to
  `follow-system` when the key is absent or holds an unrecognized value.
- **prefersDark**: the live OS preference, read from
  `matchMedia('(prefers-color-scheme: dark)')`. A `change` listener keeps it
  current so switching the OS dark-mode setting re-renders the app without a
  reload — but only while `mode === 'follow-system'`. An explicit `light` or
  `dark` choice overrides the OS preference entirely.
- **effectiveMode**: a pure derivation
  (`resolveEffectiveMode(mode, prefersDark)`) that produces the concrete
  `PaletteMode` fed to `createAppTheme`. Computed during render rather than
  mirrored in a second `useState` to avoid the duplicated-state anti-pattern.

`setMode(next)` updates the live state and persists to `localStorage`
(best-effort; storage failures are swallowed).

### Anti-flash inline script

A synchronous `<script>` block in `<head>` (`apps/web/index.html`) runs before
the React bundle. It mirrors the provider's cascade exactly:
`localStorage` -> OS `prefers-color-scheme` -> `light` (fail-safe). It sets a
CSS variable (`--mikrouli-initial-bg`) consumed by an inline `<style>` rule on
`body`, sets `data-mui-color-scheme` on `<html>`, and updates the
`<meta name="theme-color">` tag so browser chrome (mobile address bar) matches.
The script validates strictly against the same three `ThemeMode` literals; any
other stored value falls through to the default.

The `mikrouli.themeMode` localStorage key and the three `ThemeMode` literals
are a shared contract between the inline script and `theme-mode-context.tsx`.
Both sides must change together or the first paint will diverge from React's
resolved mode.

### Provider composition

`apps/web/src/main.tsx` composes the provider stack:
`StrictMode > ThemeModeProvider > ThemedApp`. `ThemedApp` reads
`useThemeMode().effectiveMode` and calls `createAppTheme` on every render, then
wraps `ThemeProvider + CssBaseline > BrowserRouter > App`. This places the theme
context above the router so every route gets the correct theme.

### ThemeModeSwitch UI

`ThemeModeSwitch` (`apps/web/src/components/ThemeModeSwitch.tsx`) is a three-way
MUI `Select` in the app bar (next to `LocaleSwitcher`) with canonical testids
for e2e. Labels are i18n keys (`themeLight`, `themeDark`, `themeSystem`) kept in
parity across `en`, `de`, `el`.

### Storybook integration

The Storybook preview (`apps/web/.storybook/preview.tsx`) adds a theme toolbar
(light/dark) alongside the locale toolbar. The global decorator calls
`createAppTheme(mode)` with the toolbar-selected mode so stories render with
production palette tokens for either mode.

## Alternatives considered

**CSS custom properties with `prefers-color-scheme` media queries only.**
This avoids JavaScript entirely for follow-system mode but cannot express an
explicit user override (light/dark) without a JS-driven class toggle, and it
does not integrate with MUI's `ThemeProvider` (which is the system every
component already uses for spacing, typography, and shape tokens). Adopting a
parallel CSS-variable system would mean maintaining two color systems.

**`next-themes` or a similar library.** The app is a Vite SPA, not a Next.js
app. The `ThemeModeContext` + inline script approach is ~140 lines and has no
dependency cost. The library would add a runtime dependency for behavior that is
straightforward to implement and test.

**A single `dark` boolean instead of a three-way enum.** This cannot express
`follow-system`, which is the default and the mode most users expect. A boolean
would require conflating "user chose dark" with "OS is dark", losing the ability
to distinguish an explicit override from a derived value — which is exactly what
the live-tracking logic depends on.

**Deciding the theme inside React with a loading state.** Without the inline
script, the browser paints the default (light) background until React mounts
and `ThemeModeProvider` resolves the mode. For a dark-mode user this is a
visible flash on every page load. The inline script eliminates the flash by
setting the background before the bundle loads.

## Consequences

- The `mikrouli.themeMode` localStorage key and the three `ThemeMode` literals
  (`light`, `dark`, `follow-system`) are a closed enum shared across five files:
  `theme-mode-context.tsx`, `index.html`, `theme.ts` (via `paletteFor`),
  `.storybook/preview.tsx` (`THEME_ITEMS`), and the locale strings. Adding a
  new mode requires extending all five in the same change.
- All component overrides must read from palette tokens inside `componentsFor(t)`,
  not from raw hex literals. A per-mode literal breaks the dark palette silently
  (the override renders with the wrong-mode color). This is a new convention
  enforced by code review, not by the type system.
- The inline script and the React provider must not diverge. The script cannot
  import the provider's module (it runs before the bundle), so the contract is
  maintained by convention and verified by the e2e spec
  (`apps/web/e2e/theme.spec.ts`), which tests first-paint correctness, manual
  toggle, persistence across reload, and live follow-system tracking.
- The deprecated `theme` bridge export adds a small maintenance surface until
  removed. It exists so that consumers that have not yet migrated to
  `createAppTheme` continue to compile.
