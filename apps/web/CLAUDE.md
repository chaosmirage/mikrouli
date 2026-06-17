# web

React 18 SPA built with Vite and MUI v5, served behind the nginx reverse
proxy. The workspace holds the component source, unit tests (Vitest), e2e
tests (Playwright), and the Storybook component catalog.

## Commands

```sh
pnpm --filter web dev              # Vite HMR dev server on :5173
pnpm --filter web build            # tsc --noEmit && vite build
pnpm --filter web lint             # eslint --max-warnings 0
pnpm --filter web test             # vitest run
pnpm --filter web e2e              # Playwright e2e (stack must be up on :8888)
pnpm --filter web storybook        # Storybook dev server on :6006
pnpm --filter web build-storybook  # build static catalog to storybook-static/
```

## Architecture

Provide the browser-facing URL-shortener UI: link creation, analytics
dashboards, API-key management, and authentication flows. The Vite
toolchain compiles TypeScript under strict mode, ESLint enforces zero
warnings, and Storybook renders isolated components with the real MUI
theme and i18n provider.

## Conventions

- Name React components in PascalCase: `DashboardPage.tsx`.
- Colocate unit tests beside the source: `*.test.tsx` / `*.test.ts` (Vitest).
- Keep the three locales (`en`, `de`, `el`) under `src/i18n/locales/` in parity.
- All raw hex color literals MUST live in `theme.ts`; use palette tokens elsewhere.
- Call `createAppTheme(mode)` in any decorator, story, or provider; never use the deprecated `theme` bridge export in new code.

## Constraints

- Never weaken the root `tsconfig.json` flags (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`).
- Never inline hex values in `*.tsx`; express colors via palette tokens in `componentsFor(t)`.
- Never hand-edit generated output; change TypeSpec and regenerate.
- The `mikrouli.themeMode` localStorage key and `ThemeMode` literals are a shared contract between `theme-mode-context.tsx` and the inline anti-flash script in `index.html`.

## Key pieces

- `package.json` -- scripts and dependencies. `type: module`. Key scripts:
  `dev` (Vite HMR), `build` (tsc --noEmit && vite build), `lint`
  (--max-warnings 0), `test` (vitest run), `storybook` (dev server on
  :6006), `build-storybook` (static catalog). All `@storybook/*` deps are
  devDependencies pinned to matching versions.
- `vite.config.ts` -- Vite plugin chain (`@vitejs/plugin-react`), dev
  proxy (`/api/` -> localhost:3000), and Vitest configuration (jsdom,
  `include: src/**/*.{test,spec}.{ts,tsx}`). The Storybook Vite builder
  loads this automatically.
- `.eslintrc.cjs` -- ESLint with react-refresh, react-hooks, and
  TypeScript rules. Story files (`*.stories.tsx`) get a scoped override
  that turns off `react-refresh/only-export-components` since CSF3
  exports a default meta alongside named story objects.
- `tsconfig.json` -- strict mode with `noUnusedLocals`,
  `noUnusedParameters`, `noFallthroughCasesInSwitch`. Excludes test and
  spec files from the main compilation; stories type-check under the same
  strict flags.
- `.storybook/main.ts` -- Storybook config using `@storybook/react-vite`
  framework. Stories glob: `../src/**/*.stories.tsx`. Telemetry disabled.
- `.storybook/preview.tsx` -- global decorator wrapping every story in
  `ThemeProvider` (calling `createAppTheme(mode)` from `src/theme.ts`)
  + `CssBaseline` + i18next. Two toolbars via `@storybook/addon-toolbars`:
  a locale toolbar (en/de/el) and a theme toolbar (light/dark) that feeds
  the selected `PaletteMode` straight into `createAppTheme`. Router,
  QueryClient, and AuthContext are per-story decorators, not global.
- `src/theme.ts` -- MUI theme factory `createAppTheme(mode: PaletteMode)`.
  Owns every raw hex literal in the web app (light and dark palettes);
  component overrides are written once against palette tokens so a single
  overrides block serves both modes. Callers (stories, `main.tsx`) call
  the factory and never inline hex values. The module also re-exports a
  deprecated pre-built `theme = createAppTheme('light')` bridge for
  not-yet-migrated consumers; remove it once every caller uses the
  factory directly.
- `src/theme-mode-context.tsx` -- React context, provider, and
  `useThemeMode` hook for the user's visual-mode choice. Persists the
  choice to `localStorage` under `mikrouli.themeMode`; resolves
  `follow-system` against `prefers-color-scheme` and tracks live OS
  changes via `matchMedia`. Sits above the theme factory in `main.tsx`
  so the resolved `effectiveMode` drives `createAppTheme` on every render.
- `src/main.tsx` -- app bootstrap: OTel instrumentation, i18n init,
  `ThemeModeProvider` > `ThemedApp` (reads `useThemeMode().effectiveMode`
  and calls `createAppTheme`, then composes `ThemeProvider` +
  `CssBaseline` > `BrowserRouter` > `App`). Storybook replicates the
  theme + i18n wiring but skips OTel.
- `src/App.tsx` -- composition root with the provider stack:
  QueryClientProvider > AuthProvider > Routes/Outlet. Page stories that
  need these providers add per-story decorators.
- `nginx-spa.conf` -- SPA nginx server config used in Docker Compose (not
  k8s). Key behaviors: `absolute_redirect off` prevents nginx from
  rewriting directory redirects into absolute URLs that expose the internal
  `:8080` port; `location = /connect` serves the prerendered static connect
  page at exactly `/connect` without a trailing-slash redirect. The k8s
  equivalent lives in `k8s/base/web/configmap-nginx.yaml` and must be kept
  in parity with this file.

## How to extend safely

- Add Storybook devDependencies to `package.json` in `apps/web`, then run
  `pnpm install` at the workspace root to regenerate `pnpm-lock.yaml`.
  CI uses `--frozen-lockfile` and fails on a stale lockfile.
- Place new story files beside their source as `*.stories.tsx`; the glob
  in `.storybook/main.ts` discovers them automatically.
- If a new ESLint rule breaks story files, add a scoped override in
  `.eslintrc.cjs` under the `src/**/*.stories.tsx` files block rather
  than weakening the rule globally.
- Call `createAppTheme(mode)` from `src/theme.ts` in any decorator,
  story, or provider; never pass inline color literals to ThemeProvider
  or story args, and never reach for the deprecated `theme` bridge
  export in new code.
- When adding a new visual element, express its colors via palette
  tokens (`t.palette.background.default`, `t.palette.text.primary`, etc.)
  inside the `componentsFor` overrides block so the element renders
  correctly in both light and dark without per-mode literals.
- Keep the global Storybook decorator thin (theme + i18n only). Add
  heavy providers (Router, QueryClient, AuthContext) as per-story
  decorators.
- Extend the locale toolbar by adding items to `LOCALE_ITEMS`, or the
  theme toolbar by adding items to `THEME_ITEMS`, in
  `.storybook/preview.tsx`; maintain locale parity with
  `src/i18n/locales/` (en/de/el) and theme parity with the
  `PaletteMode` literals consumed by `createAppTheme`.
- New npm scripts go in `apps/web/package.json`, not the workspace root;
  root scripts are for cross-workspace orchestration only.
