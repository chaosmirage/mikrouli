import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { useResourceList } from '../hooks/useResourceList';
import ConfirmDialog from '../components/ConfirmDialog';

async function loadApiKeys(): Promise<[ApiKeySummary[], string | null]> {
  try {
    const response = await apiFetch('/api/api-keys', 'get');
    return [response.data, null];
  } catch (err) {
    return [[], extractErrorMessage(err)];
  }
}

async function attemptCreateKey(label: string): Promise<[ApiKeyCreated | null, string | null]> {
  try {
    const key = await apiFetch('/api/api-keys', 'post', { body: { label } });
    return [key, null];
  } catch (err) {
    return [null, extractErrorMessage(err)];
  }
}

async function attemptRevokeKey(id: string): Promise<string | null> {
  try {
    await apiFetch('/api/api-keys/{id}', 'delete', { pathParams: { id } });
    return null;
  } catch (err) {
    return extractErrorMessage(err);
  }
}

interface CreateKeyCardProps {
  label: string;
  loading: boolean;
  error: string | null;
  onChange: (v: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}
function CreateKeyCard({ label, loading, error, onChange, onSubmit }: CreateKeyCardProps) {
  const { t } = useTranslation('apiKeys');
  return (
    <Card data-testid="create-key-card">
      <CardContent>
        <form onSubmit={onSubmit} data-testid="create-key-form">
          <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
              <TextField
                label={t('label')}
                value={label}
                onChange={(e) => onChange(e.target.value)}
                inputProps={{ 'data-testid': 'key-label' }}
                required
                sx={{ flex: 1 }}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                data-testid="key-create"
                sx={{ whiteSpace: 'nowrap' }}
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
  const copyBtn = (
    <IconButton size="small" onClick={() => onCopy(apiKey.key)} data-testid="copy-key-secret">
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
          onClick={() => onRevoke(apiKey.id)}
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
  const {
    data: keys,
    error: keysError,
    loading: keysLoading,
    refresh: triggerRefresh,
  } = useResourceList(loadApiKeys);
  const [labelInput, setLabelInput] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<ApiKeyCreated | null>(null);
  const [revokeCandidate, setRevokeCandidate] = useState<string | null>(null);

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreateLoading(true);
    const [key, error] = await attemptCreateKey(labelInput);
    setCreateError(error);
    setCreateLoading(false);
    if (!error && key) {
      setNewKey(key);
      setLabelInput('');
      triggerRefresh();
    }
  };

  const handleRevoke = async () => {
    if (!revokeCandidate) return;
    await attemptRevokeKey(revokeCandidate);
    setRevokeCandidate(null);
    triggerRefresh();
  };

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

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
        <NewKeyAlert apiKey={newKey} onDismiss={() => setNewKey(null)} onCopy={handleCopy} />
      )}
      <KeysTable
        keys={keys}
        loading={keysLoading}
        fetchError={keysError}
        onRevoke={setRevokeCandidate}
      />
      <ConfirmDialog
        open={!!revokeCandidate}
        title={t('revokeKey')}
        description={t('revokeBody')}
        confirmLabel={t('revoke')}
        onConfirm={handleRevoke}
        onCancel={() => setRevokeCandidate(null)}
        dialogTestId="revoke-dialog"
        cancelTestId="revoke-cancel"
        confirmTestId="revoke-confirm"
      />
    </Stack>
  );
}
