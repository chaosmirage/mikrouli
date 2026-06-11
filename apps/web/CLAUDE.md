# web

React 18 SPA built with Vite and MUI v5, served behind the nginx reverse
proxy. The workspace holds the component source, unit tests (Vitest), e2e
tests (Playwright), and the Storybook component catalog.

## Purpose

Provide the browser-facing URL-shortener UI: link creation, analytics
dashboards, API-key management, and authentication flows. The Vite
toolchain compiles TypeScript under strict mode, ESLint enforces zero
warnings, and Storybook renders isolated components with the real MUI
theme and i18n provider.

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
  `ThemeProvider` (using `theme` from `src/theme.ts`) + `CssBaseline` +
  i18next. Locale toolbar via `@storybook/addon-toolbars` with en/de/el.
  Router, QueryClient, and AuthContext are per-story decorators, not
  global.
- `src/theme.ts` -- single MUI theme object. All color literals live
  here; stories and components import `theme` and never inline hex values.
- `src/main.tsx` -- app bootstrap: OTel instrumentation, i18n init,
  ThemeProvider, CssBaseline, BrowserRouter. Storybook replicates
  ThemeProvider + i18n but skips OTel.
- `src/App.tsx` -- composition root with the provider stack:
  QueryClientProvider > AuthProvider > Routes/Outlet. Page stories that
  need these providers add per-story decorators.

## How to extend safely

- Add Storybook devDependencies to `package.json` in `apps/web`, then run
  `pnpm install` at the workspace root to regenerate `pnpm-lock.yaml`.
  CI uses `--frozen-lockfile` and fails on a stale lockfile.
- Place new story files beside their source as `*.stories.tsx`; the glob
  in `.storybook/main.ts` discovers them automatically.
- If a new ESLint rule breaks story files, add a scoped override in
  `.eslintrc.cjs` under the `src/**/*.stories.tsx` files block rather
  than weakening the rule globally.
- Import `theme` from `src/theme.ts` in any decorator or story; never
  pass inline color literals to ThemeProvider or story args.
- Keep the global Storybook decorator thin (theme + i18n only). Add
  heavy providers (Router, QueryClient, AuthContext) as per-story
  decorators.
- Extend the locale toolbar by adding items to `LOCALE_ITEMS` in
  `.storybook/preview.tsx`; maintain en/de/el parity with
  `src/i18n/locales/`.
- New npm scripts go in `apps/web/package.json`, not the workspace root;
  root scripts are for cross-workspace orchestration only.
