/**
 * Verifies the terms reading as a user observes it: the container and the
 * five required sections (lawful-use, user-responsibility,
 * operator-disclaimer, link-retention, contact), the two legal texts staged
 * together at the head as one pair (the open text's reach and the sibling
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
import TermsPage from './TermsPage';
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

function renderTerms(mode: PaletteMode = 'light', initialEntries: string[] = ['/terms']) {
  const theme = createAppTheme(mode);
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={initialEntries}>
        <TermsPage />
        <LocationPath />
      </MemoryRouter>
    </ThemeProvider>,
  );
  return theme;
}

describe('TermsPage', () => {
  it('renders the terms page container', () => {
    renderTerms();
    expect(screen.getByTestId('terms-page')).toBeInTheDocument();
  });

  it('renders the lawful-use section', () => {
    renderTerms();
    expect(screen.getByTestId('terms-lawful-use')).toBeInTheDocument();
  });

  it('renders the user-responsibility section', () => {
    renderTerms();
    expect(screen.getByTestId('terms-user-responsibility')).toBeInTheDocument();
  });

  it('renders the operator-disclaimer section', () => {
    renderTerms();
    expect(screen.getByTestId('terms-operator-disclaimer')).toBeInTheDocument();
  });

  it('renders the link-retention section', () => {
    renderTerms();
    expect(screen.getByTestId('terms-link-retention')).toBeInTheDocument();
  });

  it('renders the contact section', () => {
    renderTerms();
    expect(screen.getByTestId('terms-contact')).toBeInTheDocument();
  });

  it('stages the legal pair at the head with the open text marked', () => {
    renderTerms();
    const pair = screen.getByTestId('legal-pair');
    const openReach = within(pair).getByRole('link', { name: 'Terms' });
    const siblingReach = within(pair).getByRole('link', { name: 'Privacy' });
    expect(openReach).toHaveAttribute('aria-current', 'page');
    expect(siblingReach).not.toHaveAttribute('aria-current');
  });

  it('opens the sibling text of the pair on one activation', async () => {
    const user = userEvent.setup();
    renderTerms();
    await user.click(screen.getByRole('link', { name: 'Privacy' }));
    expect(screen.getByTestId('location-path')).toHaveTextContent('/privacy');
  });

  it('returns to the place the reading was reached from', async () => {
    const user = userEvent.setup();
    renderTerms('light', ['/dashboard', '/terms']);
    await user.click(screen.getByTestId('legal-back'));
    expect(screen.getByTestId('location-path')).toHaveTextContent('/dashboard');
  });

  it('bounds the reading column at the reading measure and centers it', () => {
    renderTerms();
    expect(screen.getByTestId('terms-reading')).toHaveStyle({
      maxWidth: `${SPACE.measure}px`,
      marginLeft: 'auto',
      marginRight: 'auto',
    });
  });

  it.each(['light', 'dark'] as const)(
    'carries the strongest ink over the whole %s reading with no accent anywhere',
    (mode) => {
      const theme = renderTerms(mode);
      const reading = screen.getByTestId('terms-reading');
      expect(reading).toHaveStyle({ color: rgbColor(theme.palette.text.primary) });
      const accent = rgbColor(theme.palette.primary.main);
      const accented = Array.from(reading.querySelectorAll('*')).filter(
        (element) => getComputedStyle(element).color === accent,
      );
      expect(accented).toEqual([]);
    },
  );

  it('sets the reading body at the body step with the sustained line height', () => {
    renderTerms();
    const reading = screen.getByTestId('terms-reading');
    const bodyParagraphs = Array.from(reading.querySelectorAll('p.MuiTypography-body1'));
    // The intro plus the five section bodies.
    expect(bodyParagraphs).toHaveLength(6);
    for (const paragraph of bodyParagraphs) {
      expect(paragraph).toHaveStyle({ lineHeight: '1.5' });
    }
    // Only the last-updated standing sits at the meta step.
    const metaParagraphs = Array.from(reading.querySelectorAll('p.MuiTypography-body2'));
    expect(metaParagraphs).toHaveLength(1);
  });

  it('names the reading at the title step with the section headings below it', () => {
    renderTerms();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(5);
  });
});
