import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the mikrouli heading', () => {
    render(<App />);
    expect(screen.getByText('mikrouli')).toBeInTheDocument();
  });

  it('renders a primary contained Button', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /primary action/i })).toBeInTheDocument();
  });
});
