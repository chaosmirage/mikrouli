import { Fragment, FormEvent, ReactNode, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import BlockIcon from '@mui/icons-material/Block';
import type { Theme } from '@mui/material/styles';
import { apiFetch } from '../api/client';
import type { ApiKeyCreated, ApiKeySummary } from '../api/types';
import CopyControl from '../components/CopyControl';
import StandingsRow from '../components/StandingsRow';
import StatementBand from '../components/StatementBand';
import type { StatementBandState } from '../components/StatementBand';
import { formatDate } from '../i18n/format';

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

// Zone separation between the issuing and the standing review.
const ZONE_SPACING = 5;

const KEY_LABEL_INPUT_PROPS = { 'data-testid': 'key-label' } as const;
const CREATE_BUTTON_SX = { whiteSpace: 'nowrap' } as const;
const CREATE_FIELD_SX = { flex: 1 } as const;

// The secret reads in the theme's fixed-width register: a character-exact
// string must be read character-exactly, because a mistyped key fails late.
// (The optional chain keeps the value legible under a theme that predates
// the register.)
const SECRET_VALUE_SX = {
  fontFamily: (theme: Theme) => theme.typography.technical?.fontFamily,
  fontSize: '0.875rem',
  wordBreak: 'break-all',
} as const;

const SECRET_ACTS_SX = { display: 'flex', alignItems: 'center', gap: 0.5 } as const;

const REVIEW_LIST_SX = { p: 2 } as const;

// The review's ONE shared row template: the key name is the only flexible
// track and it is bounded (fr over a zero floor, so its width never depends
// on any row's content — a longer name folds inside its own track), the
// prefix/dates/status size to their strings, and the acts end the row. Every
// review row adopts these exact tracks, so like-positioned standings — and
// the acts — start at the same x in every row, whatever a credential is
// named.
const KEY_ROW_COLUMNS = 'minmax(0, 1fr) max-content max-content max-content max-content auto';

// The review's rows: from md up they become one grid carrying the shared
// template — each row adopts its tracks, so the columns hold one line.
// Below md the rows fold individually, which is the readable shape there.
const REVIEW_ROWS_SX = {
  display: { xs: 'flex', md: 'grid' },
  flexDirection: 'column',
  columnGap: { md: 3 },
  gridTemplateColumns: { md: KEY_ROW_COLUMNS },
} as const;

// A row divider spans every track of the shared template at md; below md it
// is the review's plain hairline.
const ROW_DIVIDER_SX = { gridColumn: { md: '1 / -1' } } as const;

// The credential's name is bounded matter: it can shrink below its content
// inside its track and folds there (a spaceless name breaks anywhere),
// never widening the track or pushing another column's x.
const KEY_NAME_SX = { minWidth: 0, overflowWrap: 'anywhere' } as const;

/**
 * The issuing act's whole aftermath, one state at a time: idle, under way,
 * refused with its cause, or issued with the secret received into keeping.
 * Discriminated so impossible combinations cannot be expressed.
 */
type IssueOutcome =
  | { readonly kind: 'idle' }
  | { readonly kind: 'underway' }
  | { readonly kind: 'refused'; readonly cause: unknown }
  | { readonly kind: 'issued'; readonly key: ApiKeyCreated };

/** The band the issuing act states in the moment: under way, or the refusal. */
function issueBandState(outcome: IssueOutcome): StatementBandState | null {
  if (outcome.kind === 'underway') return { kind: 'underway' };
  if (outcome.kind === 'refused') return { kind: 'failure', cause: outcome.cause };
  return null;
}

/** The surface's own naming and the one line naming the capability. */
function CapabilityStatement() {
  const { t } = useTranslation('apiKeys');
  return (
    <Stack spacing={1}>
      <Typography variant="h4" component="h1">
        {t('title')}
      </Typography>
      <Typography color="text.secondary">{t('intro')}</Typography>
    </Stack>
  );
}

interface IssueZoneProps {
  label: string;
  outcome: IssueOutcome;
  onLabelChange: (v: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}
function IssueZone({ label, outcome, onLabelChange, onSubmit }: IssueZoneProps) {
  const { t } = useTranslation('apiKeys');
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onLabelChange(e.target.value),
    [onLabelChange],
  );
  return (
    <Card data-testid="create-key-card">
      <CardContent>
        <form onSubmit={onSubmit} data-testid="create-key-form">
          <Stack spacing={1.5}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              alignItems={{ sm: 'center' }}
            >
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
                disabled={outcome.kind === 'underway'}
                data-testid="key-create"
                sx={CREATE_BUTTON_SX}
              >
                {t('create')}
              </Button>
            </Stack>
            <StatementBand state={issueBandState(outcome)} />
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}

interface SecretShowingProps {
  apiKey: ApiKeyCreated;
  onDismiss: () => void;
}
/**
 * The secret's one showing: the receipt stated as the aftermath of the issuing
 * act, and the value itself standing in its own glance to be carried onward —
 * takeable in one activation with the landing confirmed beside it.
 */
function SecretShowing({ apiKey, onDismiss }: SecretShowingProps) {
  const { t } = useTranslation('apiKeys');
  return (
    <Stack data-testid="key-secret-once" spacing={1.5}>
      <StatementBand state={{ kind: 'landed' }} landedKey="apiKeys:secretReceipt" />
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={SECRET_VALUE_SX} data-testid="key-secret-value">
          {apiKey.key}
        </Box>
        <Box sx={SECRET_ACTS_SX}>
          <CopyControl value={apiKey.key} testId="copy-key-secret" />
          <Button size="small" onClick={onDismiss} data-testid="dismiss-key-alert">
            {t('dismiss')}
          </Button>
        </Box>
      </Stack>
    </Stack>
  );
}

interface KeyReviewRowProps {
  apiKey: ApiKeySummary;
  onRevoke: (id: string) => void;
}
/** One issued credential as a labeled row: its standings, its retire reach. */
function KeyReviewRow({ apiKey, onRevoke }: KeyReviewRowProps) {
  const { t } = useTranslation('apiKeys');
  const isRevoked = apiKey.revokedAt !== null;
  const lastUsed = apiKey.lastUsedAt ? formatDate(apiKey.lastUsedAt) : t('neverUsed');
  const handleRevoke = useCallback(() => onRevoke(apiKey.id), [onRevoke, apiKey.id]);
  return (
    <StandingsRow
      aligned
      rowTestId={`key-row-${apiKey.id}`}
      identity={
        <Typography variant="subtitle1" component="span" fontWeight={600} sx={KEY_NAME_SX}>
          {apiKey.label}
        </Typography>
      }
      standings={[
        {
          label: t('prefix'),
          value: `${apiKey.keyPrefix}…`,
          testId: `key-prefix-${apiKey.id}`,
        },
        { label: t('created'), value: formatDate(apiKey.createdAt) },
        { label: t('lastUsed'), value: lastUsed },
        {
          label: t('status'),
          value: isRevoked ? t('revoked') : t('active'),
        },
      ]}
      acts={
        <IconButton
          size="small"
          onClick={handleRevoke}
          disabled={isRevoked}
          aria-label={`${t('revoke')} ${apiKey.label}`}
          data-testid={`revoke-${apiKey.id}`}
        >
          <BlockIcon fontSize="small" />
        </IconButton>
      }
    />
  );
}

interface ReviewZoneProps {
  keys: ApiKeySummary[];
  loading: boolean;
  fetchError: unknown;
  onRevoke: (id: string) => void;
}
/** What stands: the issued credentials as review rows, or the honest states. */
function ReviewZone({ keys, loading, fetchError, onRevoke }: ReviewZoneProps) {
  if (loading) return <CircularProgress data-testid="keys-loading" />;
  if (fetchError !== null) return <StatementBand state={{ kind: 'failure', cause: fetchError }} />;
  if (keys.length === 0)
    return <StatementBand state={{ kind: 'empty' }} emptyKey="apiKeys:noKeys" />;
  return (
    <Paper variant="outlined" sx={REVIEW_LIST_SX} data-testid="api-keys-table">
      <Box sx={REVIEW_ROWS_SX} data-testid="api-keys-rows">
        {keys.map((k, index) => (
          <Fragment key={k.id}>
            {index > 0 ? <Divider component="div" sx={ROW_DIVIDER_SX} /> : null}
            <KeyReviewRow apiKey={k} onRevoke={onRevoke} />
          </Fragment>
        ))}
      </Box>
    </Paper>
  );
}

export default function ApiKeysPage() {
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
  const [issueOutcome, setIssueOutcome] = useState<IssueOutcome>({ kind: 'idle' });

  const handleIssue = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setIssueOutcome({ kind: 'underway' });
      try {
        const key = await attemptCreateKey(labelInput);
        setIssueOutcome({ kind: 'issued', key });
        setLabelInput('');
        void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      } catch (cause) {
        setIssueOutcome({ kind: 'refused', cause });
      }
    },
    [labelInput, queryClient],
  );

  // Retiring is one act on the row: the credential displaces a key, not a
  // public resolving link, so no destruction confirmation is staged. A failed
  // retire surfaces on the next list refresh.
  const handleRevoke = useCallback(
    async (id: string) => {
      try {
        await attemptRevokeKey(id);
      } catch {
        // The refreshed list carries the truth; no statement is staged here.
      }
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    [queryClient],
  );

  const handleDismissSecret = useCallback(() => setIssueOutcome({ kind: 'idle' }), []);

  const fetchError = keysError ?? null;
  const secretShowing: ReactNode =
    issueOutcome.kind === 'issued' ? (
      <SecretShowing apiKey={issueOutcome.key} onDismiss={handleDismissSecret} />
    ) : null;

  return (
    <Stack spacing={ZONE_SPACING} data-testid="api-keys-page">
      <CapabilityStatement />
      <IssueZone
        label={labelInput}
        outcome={issueOutcome}
        onLabelChange={setLabelInput}
        onSubmit={handleIssue}
      />
      {secretShowing}
      <ReviewZone
        keys={keys}
        loading={keysLoading}
        fetchError={fetchError}
        onRevoke={handleRevoke}
      />
    </Stack>
  );
}
