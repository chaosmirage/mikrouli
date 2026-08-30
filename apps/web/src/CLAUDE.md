# src

## Commands

```sh
pnpm --filter web build            # tsc --noEmit && vite build
pnpm --filter web lint             # eslint --max-warnings 0
pnpm --filter web test             # vitest run (unit tests)
```

## Architecture

Root source directory for the React SPA. Contains the application entry module,
OpenTelemetry instrumentation, top-level routing, and the MUI theme factory
plus the visual-mode context that drives light/dark switching.

## Conventions

- Name React components in PascalCase: `DashboardPage.tsx`.
- Colocate unit tests beside the source: `*.test.tsx` / `*.test.ts` (Vitest).
- All raw hex color literals MUST live in `theme.ts`; use palette tokens elsewhere.
- Call `createAppTheme(mode)` from any provider, decorator, or story.

## Constraints

- Never weaken the root `tsconfig.json` flags (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`).
- The `mikrouli.themeMode` localStorage key and `ThemeMode` literals are a shared contract between `theme-mode-context.tsx` and the inline anti-flash script in `index.html`; both sides must change together.
- Never propagate `traceparent` to third-party origins; keep `propagateTraceHeaderCorsUrls` restricted to the API origin.

## Purpose

Root source directory for the React SPA. Contains the application entry module,
OpenTelemetry instrumentation, top-level routing, and the MUI theme factory
plus the visual-mode context that drives light/dark switching.

## Key pieces

- `instrumentation.ts` -- OpenTelemetry setup. Initializes the web tracer
  provider, batch exporter, and fetch / document-load / user-interaction
  instrumentations. Restricts `traceparent` header propagation to requests
  whose origin matches the current window origin (or `VITE_API_BASE_URL` in
  non-browser contexts) to prevent trace context from leaking to third-party
  services. Redacts `authorization`, `x-api-key`, and `cookie` headers on
  every span.
- `theme.ts` -- MUI theme factory `createAppTheme(mode: PaletteMode)`.
  Owns every raw hex literal in the web app: light and dark palettes,
  typography, shape radii, and a single `componentsFor(t)` overrides block
  that reads resolved palette tokens (`t.palette.background.default`,
  `t.palette.text.primary`, `t.palette.divider`, etc.) so one overrides
  block serves both modes. Contrast for primary, secondary, and warning
  tones stays >= 3.0:1 against the background in both light and dark.
- `theme-mode-context.tsx` -- React context, provider, and `useThemeMode`
  hook for the user's visual-mode choice (`light` / `dark` /
  `follow-system`). Persists the choice to `localStorage` under
  `mikrouli.themeMode`; resolves `follow-system` against the OS
  `prefers-color-scheme` and tracks live OS changes via `matchMedia`.
  Sits above the theme factory so the resolved `effectiveMode` drives
  `createAppTheme` on every render. The localStorage key and the three
  `ThemeMode` literals are mirrored verbatim by the inline anti-flash
  script in `index.html`; both sides own the contract and must not
  diverge.
- `main.tsx` -- React entry point. Composes the provider stack:
  `StrictMode` > `ThemeModeProvider` > `ThemedApp` (reads
  `useThemeMode().effectiveMode`, calls `createAppTheme`, and wraps
  `ThemeProvider` + `CssBaseline` > `BrowserRouter` > `App`). Imports
  `instrumentation.ts` and `i18n` for their side effects before mounting.
- `App.tsx` -- top-level router, QueryClientProvider, and AuthProvider
  composition.

## How to extend safely

- `propagateTraceHeaderCorsUrls` must remain restricted to the API origin.
  Never pass a wildcard regex (`/.*/`) -- that would forward the `traceparent`
  header to every third-party URL fetched by the app.
- To enable telemetry in an environment, set `VITE_OTEL_ENABLED=true` and
  `VITE_OTEL_EXPORTER_OTLP_ENDPOINT` in the Vite environment. Telemetry is
  disabled by default in development.
- Sensitive headers in `SENSITIVE_HEADERS` are redacted on every span at the
  instrumentation layer. If new sensitive headers are introduced (e.g. a new
  API key header), add them to this constant.
- `instrumentation.ts` runs as a side effect when first imported; `main.tsx`
  imports it before mounting React so the provider is registered before any
  fetch calls are made.
- All raw hex color literals in the web app MUST live in `theme.ts` only;
  `theme-tokens.test.ts` audits every source file plus `index.html` for
  hex, `rgb`, and `hsl` literals and fails anywhere outside the two
  sanctioned homes: the theme module itself, and the pre-React cascade in
  `index.html`, which may restate exactly the two canvas tokens (one per
  color mode) because it runs before the bundle and cannot read the
  factory. Call `createAppTheme(mode)` from any provider, decorator, or
  story; never inline hex values in `*.tsx`.
- When overriding a MUI component, read colors from palette tokens
  (`t.palette.background.default`, `t.palette.text.primary`,
  `t.palette.divider`, etc.) inside `componentsFor(t)`. This is the mechanism
  that lets mode switches flow through `createAppTheme` without rewriting
  overrides per mode; a per-mode literal breaks the dark palette.
- The `mikrouli.themeMode` localStorage key and the three `ThemeMode`
  literals (`light`, `dark`, `follow-system`) are a shared contract between
  `theme-mode-context.tsx` and the inline anti-flash script in
  `index.html`. Change one side and the other in the same commit, or the
  first paint will flash in the wrong mode.
- Keep new theme modes out of `ThemeMode` unless you also extend
  `paletteFor`, the OS-preference resolution in
  `theme-mode-context.tsx`, the inline script in `index.html`, the
  Storybook `THEME_ITEMS` toolbar, the e2e spec, and the locale strings
  (`themeLight` / `themeDark` / `themeSystem`). The closed enum is
  load-bearing across five files.
