import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import type { PaletteMode, Theme } from '@mui/material/styles';
import StatementBand from './StatementBand';
import type { StatementBandState } from './StatementBand';
import { createAppTheme } from '../theme';
import { ApiError } from '../api/client';

// The band is observed exactly as a user observes it: the statement text it
// stands and the severity register it carries. The severity register is part
// of the observable contract (each aftermath kind states itself at its own
// step), so the composed MUI severity class is asserted, not any internal.

function bandElement(): HTMLElement {
  return screen.getByTestId('statement-band');
}

describe('StatementBand', () => {
  it('renders nothing when there is no aftermath to state', () => {
    const { container } = render(<StatementBand state={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('states that work is under way at the calm register', () => {
    render(<StatementBand state={{ kind: 'underway' }} />);
    expect(bandElement()).toHaveTextContent('In progress…');
    expect(bandElement()).toHaveClass('MuiAlert-standardInfo');
  });

  it('states a landed act with the shared copied confirmation', () => {
    render(<StatementBand state={{ kind: 'landed' }} />);
    expect(bandElement()).toHaveTextContent('Copied');
    expect(bandElement()).toHaveClass('MuiAlert-standardSuccess');
  });

  it('states the honest empty at its own register', () => {
    render(<StatementBand state={{ kind: 'empty' }} />);
    expect(bandElement()).toHaveTextContent('Nothing here yet');
    expect(bandElement()).toHaveClass('MuiAlert-standardWarning');
  });

  it('states the empty with the surface key the host names', () => {
    render(<StatementBand state={{ kind: 'empty' }} emptyKey="stats:noData" />);
    expect(bandElement()).toHaveTextContent('No clicks recorded yet');
  });

  it('states a refusal as the resolved problem-details message, never a raw code', () => {
    const refusal = new ApiError(
      422,
      'url must be a valid URL',
      'https://mikrouli.dev/problems/validation',
    );
    render(<StatementBand state={{ kind: 'failure', cause: refusal }} />);
    const band = bandElement();
    expect(band).toHaveTextContent('url must be a valid URL');
    expect(band).toHaveClass('MuiAlert-standardError');
    // The failure statement carries the resolved reason only: the numeric
    // status and the problem-type URI never reach the reader.
    expect(band).not.toHaveTextContent('422');
    expect(band).not.toHaveTextContent('problems/validation');
  });

  it('still states something when the refusal carries no readable reason', () => {
    render(<StatementBand state={{ kind: 'failure', cause: 'boom' }} />);
    expect(bandElement()).toHaveTextContent('An unexpected error occurred');
  });
});

// --- The one band look ---------------------------------------------------------
//
// Every aftermath statement stands in ONE look: the paper ground, a hairline
// edge, and the primary ink of the page -- the kind of aftermath is said by
// the register of the words and by the small status icon alone, never by a
// second color field behind the words. Both color modes obey the same rule
// through the theme's centralized overrides, so the look is asserted against
// the resolved tokens of each mode.

const BOTH_MODES: PaletteMode[] = ['light', 'dark'];

/** One aftermath kind paired with the status hue its icon carries. */
const AFTERMATHS: ReadonlyArray<
  readonly [StatementBandState, 'info' | 'success' | 'warning' | 'error']
> = [
  [{ kind: 'underway' }, 'info'],
  [{ kind: 'landed' }, 'success'],
  [{ kind: 'empty' }, 'warning'],
  [{ kind: 'failure', cause: 'boom' }, 'error'],
];

/** A theme hex as the `rgb(r, g, b)` string computed styles speak. */
function rgbOf(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

function renderBandIn(state: StatementBandState, theme: Theme) {
  return render(
    <ThemeProvider theme={theme}>
      <StatementBand state={state} />
    </ThemeProvider>,
  );
}

function statementIconOf(band: HTMLElement): HTMLElement {
  const icon = band.querySelector('.MuiAlert-icon');
  if (!(icon instanceof HTMLElement)) throw new Error('statement band has no status icon');
  return icon;
}

describe('StatementBand one look', () => {
  it.each(BOTH_MODES)(
    '%s mode: every aftermath kind stands on the paper ground, hairline edge, and primary ink',
    (mode) => {
      const theme = createAppTheme(mode);
      for (const [state] of AFTERMATHS) {
        const { unmount } = renderBandIn(state, theme);
        const band = bandElement();
        const stated = getComputedStyle(band);
        expect(stated.backgroundColor).toBe(rgbOf(theme.palette.surface.raised));
        expect(stated.color).toBe(rgbOf(theme.palette.ink.primary));
        expect(`${stated.borderTopWidth} ${stated.borderTopStyle} ${stated.borderTopColor}`).toBe(
          `1px solid ${rgbOf(theme.palette.line.hairline)}`,
        );
        unmount();
      }
    },
  );

  it.each(BOTH_MODES)('%s mode: the status hue lives in the icon alone', (mode) => {
    const theme = createAppTheme(mode);
    for (const [state, statusHue] of AFTERMATHS) {
      const { unmount } = renderBandIn(state, theme);
      const band = bandElement();
      expect(getComputedStyle(statementIconOf(band)).color).toBe(
        rgbOf(theme.palette[statusHue].main),
      );
      unmount();
    }
  });
});
