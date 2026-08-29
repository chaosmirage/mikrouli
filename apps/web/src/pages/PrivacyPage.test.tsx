/**
 * Verifies the privacy reading as a user observes it: the container and the
 * four required sections (data-collected, analytics, retention, contact),
 * the two legal texts staged together at the head as one pair with the same
 * reading form as the terms text (the open text's reach and the sibling
 * reach rendered identically), the reading column bounded by the reading
 * measure and centered, the body matter at the sustained-reading line height
 * in the strongest ink relation with no accent anywhere on the surface, and
 * the return reach that restores the place the reading was reached from.
 * Selectors are locale-independent data-testids and roles.
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

function renderPrivacy(mode: PaletteMode = 'light', initialEntries: string[] = ['/privacy']) {
  const theme = createAppTheme(mode);
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={initialEntries}>
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

  it('renders the data-collected section', () => {
    renderPrivacy();
    expect(screen.getByTestId('privacy-data-collected')).toBeInTheDocument();
  });

  it('renders the analytics section', () => {
    renderPrivacy();
    expect(screen.getByTestId('privacy-analytics')).toBeInTheDocument();
  });

  it('renders the retention section', () => {
    renderPrivacy();
    expect(screen.getByTestId('privacy-retention')).toBeInTheDocument();
  });

  it('renders the contact section', () => {
    renderPrivacy();
    expect(screen.getByTestId('privacy-contact')).toBeInTheDocument();
  });

  it('stages the legal pair at the head with the open text marked', () => {
    renderPrivacy();
    const pair = screen.getByTestId('legal-pair');
    const openReach = within(pair).getByRole('link', { name: 'Privacy' });
    const siblingReach = within(pair).getByRole('link', { name: 'Terms' });
    expect(openReach).toHaveAttribute('aria-current', 'page');
    expect(siblingReach).not.toHaveAttribute('aria-current');
  });

  it('opens the sibling text of the pair on one activation', async () => {
    const user = userEvent.setup();
    renderPrivacy();
    await user.click(screen.getByRole('link', { name: 'Terms' }));
    expect(screen.getByTestId('location-path')).toHaveTextContent('/terms');
  });

  it('returns to the place the reading was reached from', async () => {
    const user = userEvent.setup();
    renderPrivacy('light', ['/dashboard', '/privacy']);
    await user.click(screen.getByTestId('legal-back'));
    expect(screen.getByTestId('location-path')).toHaveTextContent('/dashboard');
  });

  it('bounds the reading column at the reading measure and centers it', () => {
    renderPrivacy();
    expect(screen.getByTestId('privacy-reading')).toHaveStyle({
      maxWidth: `${SPACE.measure}px`,
      marginLeft: 'auto',
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
    // The intro plus the four section bodies.
    expect(bodyParagraphs).toHaveLength(5);
    for (const paragraph of bodyParagraphs) {
      expect(paragraph).toHaveStyle({ lineHeight: '1.5' });
    }
    // Only the last-updated standing sits at the meta step.
    const metaParagraphs = Array.from(reading.querySelectorAll('p.MuiTypography-body2'));
    expect(metaParagraphs).toHaveLength(1);
  });

  it('names the reading at the title step with the section headings below it', () => {
    renderPrivacy();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(4);
  });
});
