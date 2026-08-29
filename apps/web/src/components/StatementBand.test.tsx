import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StatementBand from './StatementBand';
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
