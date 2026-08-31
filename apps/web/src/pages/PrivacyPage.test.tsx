/**
 * Verifies the privacy reading as a user observes it: the same family as the
 * terms text — the pair of legal texts staged together at the head with the
 * open text carrying the strongest ink, the hairline that closes the head
 * across the zone, the reading column bounded by the reading measure at the
 * zone left, the body matter at the sustained-reading line height in the
 * strongest ink relation with no accent anywhere on the surface. Selectors
 * are locale-independent data-testids and roles.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';
import PrivacyPage from './PrivacyPage';
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

function renderPrivacy(mode: PaletteMode = 'light') {
  const theme = createAppTheme(mode);
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={['/privacy']}>
        <PrivacyPage />
        <LocationPath />
      </MemoryRouter>
    </ThemeProvider>,
  );
  return theme;
}

describe('PrivacyPage', () => {
  it('renders the privacy page container', () => {
    renderPrivacy();
    expect(screen.getByTestId('privacy-page')).toBeInTheDocument();
  });

  it('stages the legal pair at the head with the open text carrying the strongest ink', () => {
    const theme = renderPrivacy();
    const pair = screen.getByTestId('legal-pair');
    const openReach = within(pair).getByRole('link', { name: 'Privacy' });
    const siblingReach = within(pair).getByRole('link', { name: 'Terms' });
    expect(openReach).toHaveAttribute('aria-current', 'page');
    expect(openReach).toHaveStyle({ color: rgbColor(theme.palette.text.primary) });
    // The sibling states itself one step quieter in the same family.
    expect(siblingReach).not.toHaveAttribute('aria-current');
    expect(siblingReach).toHaveStyle({ color: rgbColor(theme.palette.text.secondary) });
  });

  it('closes the head with a hairline rule', () => {
    renderPrivacy();
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('opens the sibling text of the pair on one activation', async () => {
    const user = userEvent.setup();
    renderPrivacy();
    await user.click(screen.getByRole('link', { name: 'Terms' }));
    expect(screen.getByTestId('location-path')).toHaveTextContent('/terms');
  });

  it('bounds the reading column at the reading measure and stands it at the zone left', () => {
    renderPrivacy();
    expect(screen.getByTestId('privacy-reading')).toHaveStyle({
      maxWidth: `${SPACE.measure}px`,
      marginRight: 'auto',
    });
  });

  it.each(['light', 'dark'] as const)(
    'carries the strongest ink over the whole %s reading with no accent anywhere',
    (mode) => {
      const theme = renderPrivacy(mode);
      const reading = screen.getByTestId('privacy-reading');
      expect(reading).toHaveStyle({ color: rgbColor(theme.palette.text.primary) });
      const accent = rgbColor(theme.palette.primary.main);
      const accented = Array.from(reading.querySelectorAll('*')).filter(
        (element) => getComputedStyle(element).color === accent,
      );
      expect(accented).toEqual([]);
    },
  );

  it('sets the reading body at the body step with the sustained line height', () => {
    renderPrivacy();
    const reading = screen.getByTestId('privacy-reading');
    const bodyParagraphs = Array.from(reading.querySelectorAll('p.MuiTypography-body1'));
    // The intro plus the two section bodies.
    expect(bodyParagraphs).toHaveLength(5);
    for (const paragraph of bodyParagraphs) {
      expect(paragraph).toHaveStyle({ lineHeight: '1.5' });
    }
    // No meta standing exists in the reading.
    expect(reading.querySelectorAll('.MuiTypography-caption')).toHaveLength(0);
  });

  it('names the reading at the title step with the section headings below it', () => {
    renderPrivacy();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(4);
  });
});
