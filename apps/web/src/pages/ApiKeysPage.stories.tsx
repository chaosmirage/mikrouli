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

// Default state: three API keys (two active, one revoked), the create-key card
// with the label input, and the quota card showing 3/10 keys used. The global
// MSW handlers cover GET/POST/DELETE /api/api-keys.
export const Default: Story = {};

// State where a key was just created: the create endpoint returns the new key
// with its one-time secret so the "secret shown once" alert renders.
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
