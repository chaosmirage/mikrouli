import type { Meta, StoryObj } from '@storybook/react';
import { http, HttpResponse } from 'msw';
import ApiKeysPage from './ApiKeysPage';
import { withAuthPage } from '../../.storybook/decorators';

const meta: Meta<typeof ApiKeysPage> = {
  title: 'Pages/ApiKeysPage',
  component: ApiKeysPage,
  decorators: [withAuthPage],
};

export default meta;

type Story = StoryObj<typeof ApiKeysPage>;

// Default state: three API keys (two active, one revoked), the capability
// statement, the create-key act with its label entering, and the review rows
// with the retire reach. The global MSW handlers cover GET/POST/DELETE
// /api/api-keys.
export const Default: Story = {};

// State where a key was just issued: the create endpoint returns the new key
// with its secret so the one showing renders with its receipt statement and
// the takeable secret.
export const WithNewKey: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/api-keys', () =>
          HttpResponse.json({
            data: [
              {
                id: 'key_001',
                label: 'Production CI/CD',
                keyPrefix: 'mk_a1b2',
                createdAt: '2026-02-01T08:00:00.000Z',
                lastUsedAt: '2026-06-20T16:45:00.000Z',
                revokedAt: null,
              },
            ],
          }),
        ),
        http.post('/api/api-keys', () =>
          HttpResponse.json(
            {
              id: 'key_new',
              label: 'New Key',
              key: 'mk_newkey_abc123def456',
              keyPrefix: 'mk_new0',
              createdAt: new Date().toISOString(),
            },
            { status: 201 },
          ),
        ),
      ],
    },
  },
};

// Review state with a retired credential among the rows: the revoked standing
// is stated and its retire reach stands disabled.
export const WithRetiredKey: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/api-keys', () =>
          HttpResponse.json({
            data: [
              {
                id: 'key_001',
                label: 'Production CI/CD',
                keyPrefix: 'mk_a1b2',
                createdAt: '2026-02-01T08:00:00.000Z',
                lastUsedAt: '2026-06-20T16:45:00.000Z',
                revokedAt: null,
              },
              {
                id: 'key_003',
                label: 'Old deploy key',
                keyPrefix: 'mk_e5f6',
                createdAt: '2025-11-02T09:15:00.000Z',
                lastUsedAt: '2026-01-05T10:00:00.000Z',
                revokedAt: '2026-06-30T18:00:00.000Z',
              },
            ],
          }),
        ),
      ],
    },
  },
};
