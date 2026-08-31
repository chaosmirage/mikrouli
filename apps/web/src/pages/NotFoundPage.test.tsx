/**
 * Verifies the not-found statement as a visitor observes it: one title naming
 * what is wrong (no page exists at the requested address) with one supporting
 * line that names the very address the visitor asked for, that address reading
 * in the fixed-width technical register while the sentence around it stays ink
 * prose, the statement bounded by the reading measure and centred, exactly one
 * act on the surface — the contained return to the shortener — and no second
 * hue anywhere: the one accent belongs to the return act alone. Selectors are
 * locale-independent data-testids and roles.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';
import NotFoundPage from './NotFoundPage';
import { SPACE, createAppTheme } from '../theme';

/** Resolves a theme hex token to the rgb() form getComputedStyle reports. */
function rgbColor(hex: string): string {
  const value = hex.replace('#', '');
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgb(${red}, ${green}, ${blue})`;
}

// Renders the router's current pathname so a navigation outcome is observable
// from the rendered tree.
function LocationPath() {
  const location = useLocation();
  return <div data-testid="location-path">{location.pathname}</div>;
}

// The address every rendering here asks for: one known-unknown value, so the
// statement's naming of the address is asserted against a real pathname
// rather than whichever route a default router lands on.
const VISITED_ADDRESS = '/some/unknown/path';

function renderNotFound(mode: PaletteMode = 'light', initialEntries: string[] = [VISITED_ADDRESS]) {
  const theme = createAppTheme(mode);
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={initialEntries}>
        <NotFoundPage />
        <LocationPath />
      </MemoryRouter>
    </ThemeProvider>,
  );
  return theme;
}

describe('NotFoundPage', () => {
  it('renders the page container with its statement', () => {
    renderNotFound();
    expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
    expect(screen.getByTestId('not-found-statement')).toBeInTheDocument();
  });

  it('names what is wrong: one title and one supporting line', () => {
    renderNotFound();
    const statement = screen.getByTestId('not-found-statement');
    const title = within(statement).getByRole('heading', { level: 1 });
    expect(title).toHaveTextContent('Page not found');
    expect(statement).toHaveTextContent(`This page does not exist at ${VISITED_ADDRESS}.`);
  });

  it('names the concrete visited address, reading it in the technical register', () => {
    const theme = renderNotFound();
    const statement = screen.getByTestId('not-found-statement');
    const address = within(statement).getByTestId('not-found-address');
    // The visitor asked for this address and no other: the statement carries
    // the address itself, not an unspecified gesture at some address.
    expect(address).toHaveTextContent(VISITED_ADDRESS);
    expect(statement).toHaveTextContent(VISITED_ADDRESS);
    // A character-exact address must be read character-exactly: the mono
    // stack, never the sans body family the surrounding sentence reads in.
    expect(getComputedStyle(address).fontFamily).toBe(theme.typography.technical.fontFamily);
    expect(getComputedStyle(address).fontFamily).not.toBe(theme.typography.body.fontFamily);
  });

  it('offers exactly one act: the contained return to the shortener', () => {
    renderNotFound();
    const page = screen.getByTestId('not-found-page');
    // The return renders as an anchor (it navigates), so the act surfaces as a
    // link; the assertion is that no second act of any kind exists.
    const acts = [...within(page).queryAllByRole('button'), ...within(page).queryAllByRole('link')];
    expect(acts).toHaveLength(1);
    expect(acts[0]).toHaveAttribute('href', '/');
    expect(acts[0]).toHaveTextContent('Back to the shortener');
  });

  it('returns to the shortener on one activation', async () => {
    const user = userEvent.setup();
    renderNotFound();
    await user.click(screen.getByTestId('not-found-back'));
    expect(screen.getByTestId('location-path')).toHaveTextContent('/');
  });

  it('bounds the statement at the reading measure and centers it', () => {
    renderNotFound();
    expect(screen.getByTestId('not-found-statement')).toHaveStyle({
      maxWidth: `${SPACE.measure}px`,
      marginLeft: 'auto',
      marginRight: 'auto',
    });
  });

  it.each(['light', 'dark'] as const)(
    'states the condition in ink with the one accent on the return act alone (%s)',
    (mode) => {
      const theme = renderNotFound(mode);
      const statement = screen.getByTestId('not-found-statement');
      const title = screen.getByRole('heading', { level: 1 });
      expect(getComputedStyle(title).color).toBe(rgbColor(theme.palette.text.primary));

      // No second hue: no element on the surface carries any state colour.
      const stateHues = (['error', 'warning', 'success', 'secondary'] as const).map((key) =>
        rgbColor(theme.palette[key].main),
      );
      const carried = Array.from(statement.querySelectorAll('*')).filter((element) => {
        const style = getComputedStyle(element);
        return stateHues.includes(style.color) || stateHues.includes(style.backgroundColor);
      });
      expect(carried).toEqual([]);

      // The single accent act: the accent hue appears only on the return
      // act's own element, and it does appear there.
      const accent = rgbColor(theme.palette.accent.solid);
      const act = screen.getByTestId('not-found-back');
      expect(getComputedStyle(act).backgroundColor).toBe(accent);
      const accentOwners = Array.from(statement.querySelectorAll('*')).filter((element) => {
        const style = getComputedStyle(element);
        return style.color === accent || style.backgroundColor === accent;
      });
      expect(accentOwners).toHaveLength(1);
      expect(act.contains(accentOwners[0])).toBe(true);
    },
  );
});
