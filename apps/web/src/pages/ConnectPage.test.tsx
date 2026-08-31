/**
 * Verifies the connect surface as a user observes it: the statement head, the
 * credential's terms and the machine's terms as labeled rows whose values
 * read in the fixed-width technical register, and the takeable example call
 * whose take is the surface's single accent. Selectors are locale-independent
 * data-testids and roles.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import ConnectPage from './ConnectPage';
import { TECHNICAL_FAMILY, createAppTheme } from '../theme';

/** Resolves a theme hex token to the rgb() form getComputedStyle reports. */
function rgbColor(hex: string): string {
  const value = hex.replace('#', '');
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgb(${red}, ${green}, ${blue})`;
}

function renderConnect(mode: PaletteMode = 'light'): Theme {
  const theme = createAppTheme(mode);
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <ConnectPage />
      </MemoryRouter>
    </ThemeProvider>,
  );
  return theme;
}

/** The value standings of a term section: every element after each label. */
function valuesOf(section: HTMLElement): HTMLElement[] {
  return Array.from(section.querySelectorAll('span.MuiTypography-technical'));
}

describe('ConnectPage', () => {
  it('renders the connect page container and the statement head', () => {
    renderConnect();
    expect(screen.getByTestId('connect-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Connect your agent');
    expect(screen.getByText(/no human at the web client/i)).toBeInTheDocument();
  });

  it('renders the credential terms as three labeled rows', () => {
    renderConnect();
    const section = screen.getByTestId('connect-credential-terms');
    expect(within(section).getByText(/issued at \/keys · shown once/i)).toBeInTheDocument();
    expect(within(section).getByText('x-api-key: mk_…')).toBeInTheDocument();
    expect(within(section).getByText('mk_ + 32 base62 chars')).toBeInTheDocument();
  });

  it('renders the machine terms as two labeled rows', () => {
    renderConnect();
    const section = screen.getByTestId('connect-machine-terms');
    expect(within(section).getByText('https://mikrou.li/api/mcp')).toBeInTheDocument();
    expect(within(section).getByText(/Streamable HTTP · stateless/)).toBeInTheDocument();
  });

  it('closes every term row with a hairline rule', () => {
    renderConnect();
    const ruled = screen
      .getAllByRole('separator')
      .filter((rule) => rule.closest('[data-testid^="connect-"]') !== null);
    // Three credential rows and two machine rows, each closed by a rule.
    expect(ruled).toHaveLength(5);
  });

  it.each(['light', 'dark'] as const)(
    'reads every term value in the %s technical register',
    (mode) => {
      renderConnect(mode);
      const values = [
        ...valuesOf(screen.getByTestId('connect-credential-terms')),
        ...valuesOf(screen.getByTestId('connect-machine-terms')),
      ];
      expect(values).toHaveLength(5);
      for (const value of values) {
        expect(getComputedStyle(value).fontFamily).toContain(
          TECHNICAL_FAMILY.split(',')[0].replace(/"/g, ''),
        );
      }
    },
  );

  it('renders the example call as its own takeable block', () => {
    renderConnect();
    const example = screen.getByTestId('connect-example-mcp');
    expect(example.textContent).toContain('curl -X POST https://mikrou.li/api/mcp');
    expect(example.textContent).toContain('-H "x-api-key: $MIKROULI_KEY"');
    expect(example.textContent).toContain('-d \'{"url": "https://example.com/launch"}\'');
    expect(within(example).getByTestId('copy-mcp-call')).toBeInTheDocument();
  });

  it('states the take of the example block as its word at the right end', () => {
    renderConnect();
    const example = screen.getByTestId('connect-example-mcp');
    const take = within(example).getByRole('button', { name: 'copy' });
    expect(take).toBeInTheDocument();
  });

  // The take word is the surface's one accent: the register is calm everywhere
  // else, so the single saturated element is the act itself.
  it.each(['light', 'dark'] as const)('carries the accent only on the take word (%s)', (mode) => {
    const theme = renderConnect(mode);
    const surface = screen.getByTestId('connect-page');
    const accent = rgbColor(theme.palette.primary.main);
    const accented = Array.from(surface.querySelectorAll('*')).filter(
      (element) => getComputedStyle(element).color === accent,
    );
    const take = screen.getByTestId('copy-mcp-call');
    expect(accented.length).toBeGreaterThan(0);
    expect(accented.every((element) => take.contains(element))).toBe(true);
  });
});
