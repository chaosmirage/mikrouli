# .storybook

Storybook configuration for the `apps/web` workspace. Controls which story
files are loaded, which addons run, and what global decorators wrap every
story canvas.

## Commands

```sh
pnpm --filter web storybook          # start Storybook dev server (HMR)
pnpm --filter web build-storybook    # build static site -> storybook-static/
```

## Architecture

Two files own the entire configuration:

- `main.ts` -- sets `framework: '@storybook/react-vite'`, the stories glob
  (`../src/**/*.stories.tsx`), and core settings (telemetry disabled).
  The Vite builder reads `apps/web/vite.config.ts` automatically, so the
  existing plugin chain is reused without duplication.
- `preview.tsx` -- exports `globalTypes` (a locale toolbar and a theme
  toolbar, both via `@storybook/addon-toolbars`) and the single global
  decorator `withThemeAndI18n`, which wraps every story in `ThemeProvider`
  by calling `createAppTheme(themeMode)` with the toolbar-selected
  `PaletteMode` (`light` or `dark`), adds `CssBaseline`, and initialises
  i18next from `../src/i18n`. Router, QueryClient, and AuthContext are
  NOT in the global decorator; stories that need them add per-story
  decorators.

## Conventions

- Call `createAppTheme(mode)` from `../src/theme` in any decorator or
  story; never pass inline color literals to `ThemeProvider` or story
  args, and never reach for the deprecated pre-built `theme` bridge
  export in new code.
- Keep the global decorator thin: only wrappers that every component needs
  (theme + i18n). Add heavy providers (Router, QueryClient) as per-story
  decorators instead.
- Place story files beside their source as `*.stories.tsx`; the glob in
  `main.ts` discovers them automatically.
- Extend the locale toolbar by adding items to `LOCALE_ITEMS`, or the
  theme toolbar by adding items to `THEME_ITEMS`, in `preview.tsx`; keep
  en/de/el in parity with `src/i18n/locales/`, and keep the theme values
  in parity with the `PaletteMode` literals consumed by
  `createAppTheme`.

## Constraints

- NEVER add a new addon without updating `addons` in `main.ts`; undeclared
  addons silently fail at build time.
- NEVER enable Storybook telemetry; `core.disableTelemetry: true` must stay
  set so CI environments do not phone home.
- NEVER inline hex color values in `preview.tsx`; call
  `createAppTheme(mode)` from `../src/theme` and let the palette tokens
  flow through `ThemeProvider` instead.
