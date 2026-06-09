import { FormEvent, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import IconButton from '@mui/material/IconButton';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import BlockIcon from '@mui/icons-material/Block';
import { apiFetch, extractErrorMessage } from '../api/client';
import type { ApiKeySummary, ApiKeyCreated } from '../api/types';
import ConfirmDialog from '../components/ConfirmDialog';

async function loadApiKeys(): Promise<ApiKeySummary[]> {
  const response = await apiFetch('/api/api-keys', 'get');
  return response.data;
}

async function attemptCreateKey(label: string): Promise<ApiKeyCreated> {
  return apiFetch('/api/api-keys', 'post', { body: { label } });
}

async function attemptRevokeKey(id: string): Promise<void> {
  await apiFetch('/api/api-keys/{id}', 'delete', { pathParams: { id } });
}

const KEY_LABEL_INPUT_PROPS = { 'data-testid': 'key-label' } as const;
const CREATE_BUTTON_SX = { whiteSpace: 'nowrap' } as const;
const CREATE_FIELD_SX = { flex: 1 } as const;

interface CreateKeyCardProps {
  label: string;
  loading: boolean;
  error: string | null;
  onChange: (v: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}
function CreateKeyCard({ label, loading, error, onChange, onSubmit }: CreateKeyCardProps) {
  const { t } = useTranslation('apiKeys');
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
    [onChange],
  );
  return (
    <Card data-testid="create-key-card">
      <CardContent>
        <form onSubmit={onSubmit} data-testid="create-key-form">
          <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
              <TextField
                label={t('label')}
                value={label}
                onChange={handleChange}
                inputProps={KEY_LABEL_INPUT_PROPS}
                required
                sx={CREATE_FIELD_SX}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                data-testid="key-create"
                sx={CREATE_BUTTON_SX}
              >
                {t('create')}
              </Button>
            </Stack>
            {error && (
              <Alert severity="error" data-testid="key-create-error">
                {error}
              </Alert>
            )}
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}

interface NewKeyAlertProps {
  apiKey: ApiKeyCreated;
  onDismiss: () => void;
  onCopy: (text: string) => void;
}
function NewKeyAlert({ apiKey, onDismiss, onCopy }: NewKeyAlertProps) {
  const { t } = useTranslation('apiKeys');
  const handleCopyKey = useCallback(() => onCopy(apiKey.key), [onCopy, apiKey.key]);
  const copyBtn = (
    <IconButton size="small" onClick={handleCopyKey} data-testid="copy-key-secret">
      <ContentCopyIcon fontSize="inherit" />
    </IconButton>
  );
  const dismissBtn = (
    <Button size="small" onClick={onDismiss} data-testid="dismiss-key-alert">
      {t('dismiss')}
    </Button>
  );
  return (
    <Alert
      severity="warning"
      data-testid="key-secret-once"
      action={
        <>
          {copyBtn}
          {dismissBtn}
        </>
      }
    >
      {t('secretOnce', { key: apiKey.key })}
    </Alert>
  );
}

interface KeyTableRowProps {
  apiKey: ApiKeySummary;
  onRevoke: (id: string) => void;
}
function KeyTableRow({ apiKey, onRevoke }: KeyTableRowProps) {
  const { t } = useTranslation('apiKeys');
  const isRevoked = apiKey.revokedAt !== null;
  const status = isRevoked ? t('revoked') : t('active');
  const lastUsed = apiKey.lastUsedAt ? apiKey.lastUsedAt.slice(0, 10) : '—';
  const handleRevoke = useCallback(() => onRevoke(apiKey.id), [onRevoke, apiKey.id]);
  return (
    <TableRow>
      <TableCell>{apiKey.label}</TableCell>
      <TableCell>{apiKey.keyPrefix}…</TableCell>
      <TableCell>{apiKey.createdAt.slice(0, 10)}</TableCell>
      <TableCell>{lastUsed}</TableCell>
      <TableCell>{status}</TableCell>
      <TableCell>
        <IconButton
          size="small"
          onClick={handleRevoke}
          disabled={isRevoked}
          data-testid={`revoke-${apiKey.id}`}
        >
          <BlockIcon fontSize="small" />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}

interface KeysTableProps {
  keys: ApiKeySummary[];
  loading: boolean;
  fetchError: string | null;
  onRevoke: (id: string) => void;
}
function KeysTable({ keys, loading, fetchError, onRevoke }: KeysTableProps) {
  const { t } = useTranslation('apiKeys');
  if (loading) return <CircularProgress data-testid="keys-loading" />;
  if (fetchError) return <Alert severity="error">{fetchError}</Alert>;
  if (keys.length === 0)
    return <Typography data-testid="no-keys-message">{t('noKeys')}</Typography>;
  return (
    <TableContainer component={Paper} data-testid="api-keys-table">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('label')}</TableCell>
            <TableCell>{t('prefix')}</TableCell>
            <TableCell>{t('created')}</TableCell>
            <TableCell>{t('lastUsed')}</TableCell>
            <TableCell>{t('status')}</TableCell>
            <TableCell>{t('revoke')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {keys.map((k) => (
            <KeyTableRow key={k.id} apiKey={k} onRevoke={onRevoke} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function ApiKeysPage() {
  const { t } = useTranslation('apiKeys');
  const queryClient = useQueryClient();
  const {
    data: keys = [],
    error: keysError,
    isLoading: keysLoading,
  } = useQuery({
    queryKey: ['api-keys'],
    queryFn: loadApiKeys,
  });
  const [labelInput, setLabelInput] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<ApiKeyCreated | null>(null);
  const [revokeCandidate, setRevokeCandidate] = useState<string | null>(null);

  const handleCreate = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setCreateLoading(true);
      try {
        const key = await attemptCreateKey(labelInput);
        setNewKey(key);
        setCreateError(null);
        setLabelInput('');
        void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      } catch (err) {
        setCreateError(extractErrorMessage(err));
      }
      setCreateLoading(false);
    },
    [labelInput, queryClient],
  );

  const handleRevoke = useCallback(async () => {
    if (!revokeCandidate) return;
    try {
      await attemptRevokeKey(revokeCandidate);
    } catch {
      // Revoke failure is surfaced on next list refresh; avoid blocking the dialog close
    }
    setRevokeCandidate(null);
    void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
  }, [revokeCandidate, queryClient]);

  const handleCopy = useCallback((text: string) => {
    void navigator.clipboard.writeText(text);
  }, []);

  const handleDismissNewKey = useCallback(() => setNewKey(null), []);
  const handleCancelRevoke = useCallback(() => setRevokeCandidate(null), []);

  const fetchError = keysError ? extractErrorMessage(keysError) : null;

  return (
    <Stack spacing={4} data-testid="api-keys-page">
      <CreateKeyCard
        label={labelInput}
        loading={createLoading}
        error={createError}
        onChange={setLabelInput}
        onSubmit={handleCreate}
      />
      {newKey && (
        <NewKeyAlert apiKey={newKey} onDismiss={handleDismissNewKey} onCopy={handleCopy} />
      )}
      <KeysTable
        keys={keys}
        loading={keysLoading}
        fetchError={fetchError}
        onRevoke={setRevokeCandidate}
      />
      <ConfirmDialog
        open={!!revokeCandidate}
        title={t('revokeKey')}
        description={t('revokeBody')}
        confirmLabel={t('revoke')}
        onConfirm={handleRevoke}
        onCancel={handleCancelRevoke}
        dialogTestId="revoke-dialog"
        cancelTestId="revoke-cancel"
        confirmTestId="revoke-confirm"
      />
    </Stack>
  );
}
