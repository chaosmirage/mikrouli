# components

Shared React components used across the web app: reusable UI building
blocks (QrCode, CopyControl, StandingsRow, StatementBand, SettingsPanel,
ConfirmDialog) and feature-level forms (ShortenCard, AppShell) that are
composed into page-level views.

## Purpose

Provides the concrete, rendered UI for link creation, result display, and
common chrome. Components here are consumed by page modules under
`src/pages/` and by Storybook stories. They do not fetch data themselves
except where the component IS the primary interaction surface (ShortenCard
owns the shorten POST); all other data arrives via props.

## Key pieces

- `ShortenCard.tsx` -- Self-contained shorten form. Owns URL input,
  loading, error, and `newLink` state. On success, renders `ResultMoment`,
  the result-moment blocks under the preserved `new-link-alert` root: the
  `result-confirmation` success statement, the takeable short address
  (`result-link`) with a `CopyControl` take and its landed confirmation,
  and a `QrCode` block with both export formats (PNG + SVG). Fires the
  optional `onShortened` callback. Actor-agnostic: the API resolves Guest
  vs registered by the presence of a credential; this component just POSTs
  to `/api/urls`.
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
- `SettingsPanel.tsx` -- Dialog panel staging the homogeneous setting pair
  (color mode light/dark/follow-system + language en/de/el), opened from the
  shell band's two reaches. Selections write straight through the standing
  stores: `useThemeMode().setMode` and `i18n.changeLanguage`. Storage keys
  (`mikrouli.themeMode`, `mikrouli.locale`) and their closed-enum validation
  are unchanged; the panel adds no new storage. Test ids `settings-panel`,
  `settings-mode-option-*`, `settings-language-option-*`, `settings-close`;
  the shell reaches are `settings-mode-reach` / `settings-language-reach`.
- `ConfirmDialog.tsx` -- Generic confirmation modal; also has a Storybook
  story (`ConfirmDialog.stories.tsx`).
- `CopyControl.tsx` -- The taking control: one activation of the icon
  button puts the exact `value` onto the clipboard through
  `useCopyToClipboard`, and the landed (or failed) confirmation stands
  beside it in the same glance as a `role="status"` statement -- never a
  silent write. The confirmation's place is reserved from the first paint:
  the same statement stands hidden until the take lands, so the landing
  never reflows the row. Its address is `<testId>-confirmation` while
  reserved, `<testId>-landed` once visible, `<testId>-failed` on a refused
  take -- all derived from the `testId` prop (default `copy-link`);
  localized via the `common` namespace. Consumed wherever a takeable
  string appears: ShortenCard and the Connect, ApiKeys, and Dashboard
  pages.
- `StandingsRow.tsx` -- The shared row shape for every surface that
  compares standings: an optional `identity` node (wraps under the
  standings at narrow widths), `standings` (label + value pairs, values in
  tabular numerals so like-positioned values compare across rows), and
  optional right-aligned `acts`. The optional `aligned` prop opts a row
  into a set's shared columns: the set's container owns ONE grid template
  (a consumer-hoisted constant, switched on at the theme's md step) and
  the row adopts those tracks via subgrid, so no row's content can shift
  another row's columns; below md the row keeps the content-sized wrap
  layout. Purely presentational; a value renders as `component="div"`
  because it may be block matter (the dashboard's in-row correction
  form). Consumed by five pages (Dashboard, Stats, Usage, ApiKeys,
  Connect).
- `StatementBand.tsx` -- The aftermath vehicle for one asynchronous act:
  takes a `StatementBandState | null` discriminated union (`underway`,
  `landed`, `empty`, `failure` with unknown `cause`) and states it as one
  MUI Alert with the matching severity. Failures resolve through the shared
  problem-details extraction (`extractErrorMessage`), never the raw thrown
  value; per-surface `underwayKey`/`landedKey`/`emptyKey` overrides default
  to shared `common` keys. Test id `statement-band`. Consumed by the Usage
  and ApiKeys pages.

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
