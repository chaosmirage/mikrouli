/**
 * Verifies that ConnectPage renders all three required sections:
 * the header/intro, the REST path section, and the MCP section.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import ConnectPage from './ConnectPage';
import { theme } from '../theme';

function renderConnect() {
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <ConnectPage />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('ConnectPage', () => {
  it('renders the connect page container', () => {
    renderConnect();
    expect(screen.getByTestId('connect-page')).toBeInTheDocument();
  });

  it('renders the REST section', () => {
    renderConnect();
    expect(screen.getByTestId('connect-rest-section')).toBeInTheDocument();
  });

  it('renders the MCP section', () => {
    renderConnect();
    expect(screen.getByTestId('connect-mcp-section')).toBeInTheDocument();
  });

  it('REST section mentions x-api-key', () => {
    renderConnect();
    const section = screen.getByTestId('connect-rest-section');
    expect(section.textContent).toMatch(/x-api-key/i);
  });

  it('MCP section mentions /api/mcp', () => {
    renderConnect();
    const section = screen.getByTestId('connect-mcp-section');
    expect(section.textContent).toMatch(/\/api\/mcp/i);
  });

  it('page contains a link to llms.txt', () => {
    renderConnect();
    const links = screen.getAllByRole('link');
    const llmsLink = links.find((l) => l.getAttribute('href')?.includes('llms.txt'));
    expect(llmsLink).toBeDefined();
  });
});
