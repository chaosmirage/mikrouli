import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import StandingsRow from './StandingsRow';
import { createAppTheme } from '../theme';

function renderRow(props: React.ComponentProps<typeof StandingsRow>) {
  return render(
    <ThemeProvider theme={createAppTheme('light')}>
      <StandingsRow {...props} />
    </ThemeProvider>,
  );
}

describe('StandingsRow', () => {
  it('renders every standing as a label with its value', () => {
    renderRow({
      standings: [
        { label: 'Created', value: 'Jan 5, 2024' },
        { label: 'Expires', value: '—' },
      ],
    });
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Jan 5, 2024')).toBeInTheDocument();
    expect(screen.getByText('Expires')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders the identity slot with the row', () => {
    renderRow({
      identity: <Typography>s.io/abc</Typography>,
      standings: [{ label: 'Created', value: 'Jan 5, 2024' }],
    });
    expect(screen.getByText('s.io/abc')).toBeInTheDocument();
  });

  it('renders the act reaches inside the row', () => {
    renderRow({
      standings: [{ label: 'Created', value: 'Jan 5, 2024' }],
      acts: <button type="button">Take</button>,
    });
    expect(screen.getByRole('button', { name: 'Take' })).toBeInTheDocument();
  });

  it('carries the row test id', () => {
    renderRow({
      rowTestId: 'link-row-abc',
      standings: [{ label: 'Created', value: 'Jan 5, 2024' }],
    });
    expect(screen.getByTestId('link-row-abc')).toBeInTheDocument();
  });

  it('carries a standing test id on the standing it names', () => {
    renderRow({
      standings: [{ label: 'Created', value: 'Jan 5, 2024', testId: 'created-abc' }],
    });
    expect(screen.getByTestId('created-abc')).toHaveTextContent('Jan 5, 2024');
  });
});
