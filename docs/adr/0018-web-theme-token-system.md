# 0018. Web Theme Token System

## Status

Accepted

## Context

ADR 0017 gave the web app its two-mode theme: a `createAppTheme(mode)`
factory, component overrides that read resolved palette tokens, and the
anti-flash first-paint cascade. Below that layer, however, the app's look was
still assembled from MUI's stock vocabulary — the palette used the default
MUI groups, typography used the library's scale, and elevation, motion, and
corner radii were whatever the components shipped with. Only a handful of
per-page `sx` touches stated anything of the product's own (five literal
shadow/radius/transition spots across three pages).

A redesign of every page needed one place that states the product's entire
visual vocabulary — color, type, spacing, depth, motion, and radii — together
with its dark realization, so that every page draws from the same small set
of named values instead of restating MUI defaults, and so that qualities
such as text contrast can be stated as testable relations rather than
checked by eye per page.

## Decision

Every visual value the web app renders is a named token defined in
`apps/web/src/theme.ts`; no raw hex color, shadow, or transition literal may
live outside that file. The tokens are exposed on the MUI `Theme` through
module augmentation, so components and the single overrides block consume
them as typed theme values.

- **Palette.** Custom groups replace the stock-centric layout: an `ink`
  ladder (`primary` / `secondary` / `muted` at 7:1 / 4.5:1 / 3:1 contrast
  floors against the canvas and raised surfaces), a `surface` trio
  (`canvas` / `raised` / `veil`), one `accent` (>= 3:1 against canvas and
  raised in both modes), and `line.hairline`. Light and dark own the same
  ladder; the light canvas is `#f8fafc`, the dark canvas `#000000`.
- **Typography.** A weight-led scale with variants `display`, `title`,
  `body`, `meta`, `technical`, and `numerals`. Machine strings (short links,
  slugs, credentials, endpoint terms) read in `TECHNICAL_FAMILY`, an
  exported fixed-width register that is a role, not a second type identity.
- **Spacing.** `SPACE` — five steps at 1x / 2x / 3x / 5x / 8x of an 8px base
  (`inline`, `element`, `block`, `zone`, `page`) plus a 546px reading
  measure.
- **Depth.** `depth.rest` / `hover` / `float` — elevation is three stated
  steps and rest is none: cards render outlined at elevation 0, and the one
  floating step is reserved for dialogs.
- **Motion.** Six duration tokens (`state`, `reveal`, `float`, `narrow`,
  `hover`, `switch`) and one `decelerate` easing on
  `theme.transitions`, plus a single centralized reduced-motion rule
  (`REDUCED_MOTION_QUERY` with `REDUCED_MOTION_COLLAPSE`) wired into
  `MuiCssBaseline`, so `prefers-reduced-motion` collapses every motion token
  while every state remains reachable.
- **Radii.** Named constants: a true pill (9999px) for contained primary
  buttons, 16px cards, 8px controls.

`createAppTheme(mode)` remains the only theme entry point; the deprecated
`theme` bridge export kept by ADR 0017 is removed. One `componentsFor(t)`
overrides block serves both modes and reads only resolved tokens.

The anti-flash literals in `apps/web/index.html` are pinned to the canvas
tokens: `apps/web/src/theme-first-paint.test.ts` reads the HTML and asserts
that the script's dark and light background literals and the CSS fallback
equal `surface.canvas` for the respective mode, so the pre-React paint
cannot drift from the factory. The token relations — contrast floors, scale
ratios, ladder steps — are asserted for both modes in
`apps/web/src/theme-tokens.test.ts`.

Mode and language selection are consolidated in a `SettingsPanel` dialog
(`apps/web/src/components/SettingsPanel.tsx`) opened from the app shell,
replacing the app-bar `ThemeModeSwitch`. It owns the two user standings:
color mode (`light` / `dark` / `follow-system`) and language (`en` / `de` /
`el`, labelled by endonym).

## Alternatives considered

**Per-page `sx` styling over MUI defaults (the prior state).** Workable for
a small app, but a redesign had to be reconciled file by file, and the
per-page literal touches (the five shadow/radius/transition spots) were the
seed of the drift the token rule now prevents.

**A parallel CSS custom-property system.** Rejected for the same reason
ADR 0017 rejected it: MUI's `ThemeProvider` is the system every component
already consumes for spacing, typography, and shape; a second token
transport would mean maintaining two systems. The augmentation approach
puts the tokens inside the one system components already read.

**Keeping the deprecated `theme` bridge.** ADR 0017 kept
`export const theme = createAppTheme('light')` for not-yet-migrated
consumers. With every consumer on the factory, the bridge only added a way
to import a single-mode theme by accident; it is removed.

## Consequences

- Adding or changing any visual value means adding or changing a token in
  `theme.ts`; components consume tokens only. The rule is stated in the
  file header and enforced by review, not by the type system.
- The anti-flash literals in `index.html` must equal the canvas tokens; a
  unit test fails the suite if they diverge, closing the drift risk ADR 0017
  left to convention.
- Contrast and scale qualities are regression-tested as relations in both
  modes, so a palette tweak that breaks the ink ladder's floors or the
  spacing ladder's steps fails `theme-tokens.test.ts`.
- Mode and language preferences live in one dialog; the app bar no longer
  carries per-setting controls.
