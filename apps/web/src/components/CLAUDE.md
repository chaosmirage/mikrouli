# components

Shared React components used across the web app: reusable UI building
blocks (QrCode, ThemeModeSwitch, ConfirmDialog, EditLinkDialog) and
feature-level forms (ShortenCard, AppShell) that are composed into
page-level views.

## Purpose

Provides the concrete, rendered UI for link creation, result display, and
common chrome. Components here are consumed by page modules under
`src/pages/` and by Storybook stories. They do not fetch data themselves
except where the component IS the primary interaction surface (ShortenCard
owns the shorten POST); all other data arrives via props.

## Key pieces

- `ShortenCard.tsx` -- Self-contained shorten form. Owns URL input,
  loading, error, and `newLink` state. On success, renders `NewLinkResult`
  (short URL copy button + QrCode) and fires the optional `onShortened`
  callback. Actor-agnostic: the API resolves Guest vs registered by the
  presence of a credential; this component just POSTs to `/api/urls`.
- `QrCode.tsx` -- Presentational component wrapping `qrcode.react`
  (`QRCodeSVG`). Accepts a full public URL (`value`) and an optional pixel
  `size` (default 160). Renders the SVG and two export controls: Download
  PNG and Download SVG. Both deliver the artifact via `data:` URLs only
  (never `blob:`) to stay within the `img-src 'self' data:`
  Content-Security-Policy enforced by nginx; button labels are localized
  through the `common` i18n namespace (en/de/el). Test id `qr-code` on the
  wrapper, `qr-download` on the PNG button, `qr-download-svg` on the SVG
  button.
- `AppShell.tsx` -- Persistent navigation chrome (drawer, top bar).
- `ThemeModeSwitch.tsx` -- Icon button that cycles through light / dark /
  follow-system modes via `useThemeMode` from `src/theme-mode-context.tsx`.
- `ConfirmDialog.tsx` -- Generic confirmation modal; also has a Storybook
  story (`ConfirmDialog.stories.tsx`).
- `EditLinkDialog.tsx` -- Modal dialog for editing a link's destination
  URL. Receives the current link (slug + originalUrl), renders a
  pre-filled TextField for the new URL, and calls `onConfirm(newUrl)` on
  submit. Displays inline server-error feedback. Composition mirrors
  ConfirmDialog's modal pattern. Has a colocated test and Storybook story.

## How to extend safely

- Keep components in this directory self-contained: no direct imports from
  `src/pages/`, no circular upward dependencies.
- Hoist `sx` style objects to module scope with `as const` so every render
  reuses the same object identity (MUI re-renders on sx reference change).
- Express colors via palette tokens (`t.palette.*`) inside MUI `sx` props
  or `componentsFor` overrides in `src/theme.ts`; never inline hex literals.
- For QR download: keep the download path on `data:` URLs only. Switching
  to `blob:` would be blocked by the CSP (`img-src 'self' data:`).
- Add a colocated `*.test.tsx` (Vitest + jsdom) beside every new component.
  `qrcode.react` runs unmocked in Vitest and renders a real `<svg>`; only
  the canvas 2D context and `Image` are stubbed (jsdom has no canvas).
- Storybook stories (`*.stories.tsx`) go beside the component. Router,
  QueryClient, and AuthContext are per-story decorators, not global.
