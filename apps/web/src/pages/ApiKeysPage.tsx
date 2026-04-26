import { FormEvent, useEffect, useState } from 'react';
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
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import BlockIcon from '@mui/icons-material/Block';
import { apiFetch, extractErrorMessage } from '../api/client';
import type { ApiKeySummary, ApiKeyCreated } from '../api/types';

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
          <TextField
            label={t('label')}
            value={label}
            onChange={(e) => onChange(e.target.value)}
            inputProps={{ 'data-testid': 'key-label' }}
            required
          />
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            sx={{ mt: 1 }}
            data-testid="key-create"
          >
            {t('create')}
          </Button>
          {error && (
            <Alert severity="error" sx={{ mt: 1 }} data-testid="key-create-error">
              {error}
            </Alert>
          )}
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

interface RevokeDialogProps {
  candidate: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}
function RevokeDialog({ candidate, onConfirm, onCancel }: RevokeDialogProps) {
  const { t } = useTranslation('apiKeys');
  return (
    <Dialog open={!!candidate} onClose={onCancel} data-testid="revoke-dialog">
      <DialogTitle>{t('revokeKey')}</DialogTitle>
      <DialogContent>
        <Typography>{t('revokeBody')}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} data-testid="revoke-cancel">
          {t('cancel', { ns: 'common' })}
        </Button>
        <Button onClick={onConfirm} color="error" variant="contained" data-testid="revoke-confirm">
          {t('revoke')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<ApiKeyCreated | null>(null);
  const [revokeCandidate, setRevokeCandidate] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    void loadApiKeys().then(([ks, err]) => {
      setKeys(ks);
      setKeysError(err);
      setKeysLoading(false);
    });
  }, [refreshCount]);

  const triggerRefresh = () => setRefreshCount((c) => c + 1);

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
      <RevokeDialog
        candidate={revokeCandidate}
        onConfirm={handleRevoke}
        onCancel={() => setRevokeCandidate(null)}
      />
    </Stack>
  );
}
