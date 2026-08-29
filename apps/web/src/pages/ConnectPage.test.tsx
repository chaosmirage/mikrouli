/**
 * Verifies the connect page's three zones: the connection statement, the
 * credential's authorization terms (header + key format), and the machine
 * terms (endpoints and the takeable example calls).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import ConnectPage from './ConnectPage';
import { createAppTheme } from '../theme';

function renderConnect() {
  render(
    <ThemeProvider theme={createAppTheme('light')}>
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

  it('renders the authorization terms zone', () => {
    renderConnect();
    expect(screen.getByTestId('connect-apikey-section')).toBeInTheDocument();
  });

  it('authorization terms carry the header the credential rides on', () => {
    renderConnect();
    const section = screen.getByTestId('connect-apikey-section');
    expect(section.textContent).toMatch(/x-api-key: mk_<your-key>/i);
  });

  it('authorization terms carry the key-format standing', () => {
    renderConnect();
    const section = screen.getByTestId('connect-apikey-section');
    expect(section.textContent).toContain('mk_<your-key>');
    expect(section.textContent).toMatch(/key format/i);
  });

  it('renders the machine terms zones', () => {
    renderConnect();
    expect(screen.getByTestId('connect-rest-section')).toBeInTheDocument();
    expect(screen.getByTestId('connect-mcp-section')).toBeInTheDocument();
  });

  it('machine terms name the REST endpoint', () => {
    renderConnect();
    const section = screen.getByTestId('connect-rest-section');
    expect(section.textContent).toMatch(/POST \/api\/urls/);
  });

  it('machine terms name the MCP endpoint', () => {
    renderConnect();
    const section = screen.getByTestId('connect-mcp-section');
    expect(section.textContent).toMatch(/\/api\/mcp/);
  });

  it('renders the direct example call as its own takeable block', () => {
    renderConnect();
    const direct = screen.getByTestId('connect-example-direct');
    expect(direct.textContent).toContain('curl -s -X POST https://mikrou.li/api/urls');
    expect(direct.textContent).toContain('x-api-key');
  });

  it('renders the harness-add command as its own takeable block', () => {
    renderConnect();
    const harness = screen.getByTestId('connect-example-harness');
    expect(harness.textContent).toContain('claude mcp add');
    expect(harness.textContent).toContain('https://mikrou.li/api/mcp');
    expect(harness.textContent).toContain('--header');
  });

  it('page contains a link to llms.txt', () => {
    renderConnect();
    const links = screen.getAllByRole('link');
    const llmsLink = links.find((l) => l.getAttribute('href')?.includes('llms.txt'));
    expect(llmsLink).toBeDefined();
  });

  it('renders a prominent get-API-key zone before the machine terms', () => {
    renderConnect();
    expect(screen.getByTestId('connect-apikey-section')).toBeInTheDocument();
  });
});
