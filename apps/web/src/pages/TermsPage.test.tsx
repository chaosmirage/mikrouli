/**
 * Verifies that TermsPage renders its root container and the five required
 * section testids: lawful-use, user-responsibility, operator-disclaimer,
 * link-retention, and contact. Selectors are locale-independent data-testids.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import TermsPage from './TermsPage';
import { theme } from '../theme';

function renderTerms() {
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>
    </ThemeProvider>,
  );
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
});
