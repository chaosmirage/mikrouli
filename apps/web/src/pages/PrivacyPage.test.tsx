/**
 * Verifies that PrivacyPage renders its root container and the four required
 * section testids: data-collected, analytics, retention, and contact.
 * Selectors are locale-independent data-testids.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import PrivacyPage from './PrivacyPage';
import { theme } from '../theme';

function renderPrivacy() {
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>
    </ThemeProvider>,
  );
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
});
