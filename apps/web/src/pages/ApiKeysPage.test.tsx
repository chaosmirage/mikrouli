import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ApiKeysPage from './ApiKeysPage';

function makeResponse(data: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(data) };
}

function renderApiKeys() {
  render(<MemoryRouter><ApiKeysPage /></MemoryRouter>);
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse([])));
});

describe('ApiKeysPage', () => {
  it('renders key label input and create button', async () => {
    renderApiKeys();
    await waitFor(() => expect(screen.getByTestId('key-label')).toBeInTheDocument());
    expect(screen.getByTestId('key-create')).toBeInTheDocument();
  });

  it('creates key and displays one-time secret alert', async () => {
    const newKey = { id: 'k1', label: 'test', key: 'secret-value-xyz', keyPrefix: 'key_sec', createdAt: '2024-01-01T00:00:00Z' };
    const summary = { id: 'k1', label: 'test', keyPrefix: 'key_sec', createdAt: '2024-01-01T00:00:00Z', lastUsedAt: null, revokedAt: null };
    const mockFetch = vi.fn();
    mockFetch.mockResolvedValueOnce(makeResponse([]));
    mockFetch.mockResolvedValueOnce(makeResponse(newKey));
    mockFetch.mockResolvedValueOnce(makeResponse([summary]));
    vi.stubGlobal('fetch', mockFetch);
    renderApiKeys();
    await waitFor(() => expect(screen.getByTestId('key-label')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('key-label'), { target: { value: 'test' } });
    fireEvent.click(screen.getByTestId('key-create'));
    await waitFor(() => expect(screen.getByTestId('key-secret-once')).toBeInTheDocument());
    expect(screen.getByText(/secret-value-xyz/)).toBeInTheDocument();
  });
});
