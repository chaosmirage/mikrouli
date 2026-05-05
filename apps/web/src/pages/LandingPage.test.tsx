import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import LandingPage from './LandingPage';
import { theme } from '../theme';

function renderLanding() {
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('LandingPage', () => {
  it('renders the three hero sections', () => {
    renderLanding();
    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    expect(screen.getByTestId('landing-hero')).toBeInTheDocument();
    expect(screen.getByTestId('landing-features')).toBeInTheDocument();
    expect(screen.getByTestId('landing-bottom-cta')).toBeInTheDocument();
  });

  it('renders three feature cards', () => {
    renderLanding();
    expect(screen.getByTestId('landing-feature-1')).toBeInTheDocument();
    expect(screen.getByTestId('landing-feature-2')).toBeInTheDocument();
    expect(screen.getByTestId('landing-feature-3')).toBeInTheDocument();
  });

  it('hero CTA buttons link to register and login', () => {
    renderLanding();
    const registerCta = screen.getByTestId('landing-cta-register');
    const loginCta = screen.getByTestId('landing-cta-login');
    expect(registerCta).toHaveAttribute('href', '/register');
    expect(loginCta).toHaveAttribute('href', '/login');
  });

  it('bottom CTA links to register', () => {
    renderLanding();
    const cta = screen.getByTestId('landing-bottom-cta-register');
    expect(cta).toHaveAttribute('href', '/register');
  });

  it('headline contains both prefix and highlight text', () => {
    renderLanding();
    const headline = screen.getByTestId('landing-headline');
    expect(headline).toHaveTextContent(/Shorten your links/i);
    expect(headline).toHaveTextContent(/track every click/i);
  });
});
