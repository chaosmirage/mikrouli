import { Fragment, FormEvent, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { Theme } from '@mui/material/styles';
import { apiFetch } from '../api/client';
import type { ApiKeyCreated, ApiKeySummary } from '../api/types';
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

// The issuing entering stands bare beside its act, named by its placeholder
// alone: the filled control ground, the hairline edge, the control radius —
// the same entering every act on the surface carries.
const CREATE_FIELD_SX = {
  flex: { sm: '0 0 auto' },
  width: { xs: '100%', sm: '360px' },
  '& .MuiOutlinedInput-root': { backgroundColor: 'surface.raised' },
} as const;

// The secret's one showing stands on the accent family's quiet tint — the one
// place the accent is spent as a ground rather than as a mark — at the
// control radius, holding only what the moment must not miss.
const SECRET_SURFACE_SX = {
  backgroundColor: 'primary.light',
  borderRadius: 1,
  px: 3,
  py: 2.25,
  maxWidth: 560,
  alignSelf: 'flex-start',
} as const;

// The secret reads in the theme's fixed-width register at its own step: a
// character-exact string must be read character-exactly, because a mistyped
// key fails late. (The optional chain keeps the value legible under a theme
// that predates the register.)
const SECRET_VALUE_SX = {
  fontFamily: (theme: Theme) => theme.typography.technical?.fontFamily,
  fontSize: '1rem',
  color: 'text.primary',
  wordBreak: 'break-all',
} as const;

// The receipt is the moment's one accent reading: the aftermath statement in
// the accent ink, at the meta size.
const SECRET_RECEIPT_SX = { color: 'primary.main', fontSize: '0.75rem' } as const;

// The review's ONE shared row template: the credential's name is the only
// flexible track and it is bounded (fr over a zero floor, so its width never
// depends on any row's content — a longer name folds inside its own track),
// the standings size to their strings, and the retire reach ends the row.
// The review's head names these same tracks, so every column keeps one x
// from its head through every row.
const KEY_ROW_COLUMNS = 'minmax(0, 1fr) max-content max-content auto';

// The review's rows: one grid carrying the shared template from md up — each
// row adopts its tracks (subgrid), so like-positioned standings start at the
// same x in every row, whatever a credential is named. Below md the rows
// fold individually, which is the readable shape there.
const REVIEW_ROWS_SX = {
  display: { xs: 'flex', md: 'grid' },
  flexDirection: 'column',
  rowGap: { xs: 3, md: 0 },
  columnGap: { md: 3 },
  gridTemplateColumns: { md: KEY_ROW_COLUMNS },
} as const;

const HEAD_ROW_SX = {
  display: { xs: 'none', md: 'grid' },
  gridTemplateColumns: { md: KEY_ROW_COLUMNS },
  columnGap: { md: 3 },
  alignItems: 'end',
  pb: 1,
} as const;

const HEAD_CELL_SX = { color: 'ink.secondary' } as const;
const HEAD_ACTS_SX = { color: 'ink.secondary', textAlign: 'right' } as const;

// One review row adopts the shared tracks (subgrid) from md up; below md it
// folds into a cluster under the credential's name.
const KEY_ROW_SX = {
  display: { xs: 'flex', md: 'grid' },
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: 3,
  rowGap: 1.5,
  width: '100%',
  py: 2,
  gridTemplateColumns: { md: 'subgrid' },
  gridColumn: { md: '1 / -1' },
} as const;

// A row divider spans every track of the shared template at md; below md it
// is the review's plain hairline.
const ROW_DIVIDER_SX = { gridColumn: { md: '1 / -1' } } as const;

// The credential's name is bounded matter: it can shrink below its content
// inside its track and folds there (a spaceless name breaks anywhere),
// never widening the track or pushing another column's x.
const KEY_NAME_SX = { minWidth: 0, overflowWrap: 'anywhere', fontWeight: 600 } as const;

// The review's standings (created, last used) read at the meta size in the
// muted ink, in tabular figures.
const META_SX = {
  color: 'ink.muted',
  fontSize: '0.75rem',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
} as const;

// The retire reach: a word in the muted ink that ends the row. A retired
// credential's standing is stated beside it, never hidden.
const RETIRE_ACT_SX = { minWidth: 0, px: 0, py: 0.25, color: 'ink.muted' } as const;
const REVOKED_SX = { ...META_SX } as const;

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
      <Typography variant="title" component="h1">
        {t('title')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t('intro')}
      </Typography>
    </Stack>
  );
}

interface IssueZoneProps {
  label: string;
  outcome: IssueOutcome;
  onLabelChange: (v: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}
// The issuing zone: least ceremony — the entering beside its one act, both
// standing bare on the surface.
function IssueZone({ label, outcome, onLabelChange, onSubmit }: IssueZoneProps) {
  const { t } = useTranslation('apiKeys');
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onLabelChange(e.target.value),
    [onLabelChange],
  );
  return (
    <form onSubmit={onSubmit} data-testid="create-key-form">
      <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
          <TextField
            hiddenLabel
            placeholder={t('label')}
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
  );
}

interface SecretShowingProps {
  apiKey: ApiKeyCreated;
}
/**
 * The secret's one showing: the value itself standing in its own glance to be
 * carried onward, and the receipt stating what the moment is — both on the
 * accent-tinted surface, the one place the accent family is spent as a ground
 * rather than as a mark.
 */
function SecretShowing({ apiKey }: SecretShowingProps) {
  const { t } = useTranslation('apiKeys');
  return (
    <Box sx={SECRET_SURFACE_SX} data-testid="key-secret-once">
      <Stack spacing={1}>
        <Box sx={SECRET_VALUE_SX} data-testid="key-secret-value">
          {apiKey.key}
        </Box>
        <Typography sx={SECRET_RECEIPT_SX}>{t('secretReceipt')}</Typography>
      </Stack>
    </Box>
  );
}

interface KeyReviewRowProps {
  apiKey: ApiKeySummary;
  onRevoke: (id: string) => void;
}
/** One issued credential as a review row: its standings, its retire reach. */
function KeyReviewRow({ apiKey, onRevoke }: KeyReviewRowProps) {
  const { t } = useTranslation('apiKeys');
  const isRevoked = apiKey.revokedAt !== null;
  const lastUsed = apiKey.lastUsedAt ? formatDate(apiKey.lastUsedAt) : t('neverUsed');
  const handleRevoke = useCallback(() => onRevoke(apiKey.id), [onRevoke, apiKey.id]);
  return (
    <Box sx={KEY_ROW_SX} data-testid={`key-row-${apiKey.id}`}>
      <Typography variant="body2" component="span" sx={KEY_NAME_SX}>
        {apiKey.label}
      </Typography>
      <Typography variant="body2" sx={META_SX}>
        {formatDate(apiKey.createdAt)}
      </Typography>
      <Typography variant="body2" sx={META_SX}>
        {lastUsed}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, marginLeft: 'auto' }}>
        {isRevoked ? <Typography sx={REVOKED_SX}>{t('revoked')}</Typography> : null}
        <Button
          size="small"
          onClick={handleRevoke}
          disabled={isRevoked}
          aria-label={`${t('revoke')} ${apiKey.label}`}
          data-testid={`revoke-${apiKey.id}`}
          sx={RETIRE_ACT_SX}
        >
          {t('revoke')}
        </Button>
      </Box>
    </Box>
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
  const { t } = useTranslation('apiKeys');
  if (loading) return <CircularProgress data-testid="keys-loading" />;
  if (fetchError !== null) return <StatementBand state={{ kind: 'failure', cause: fetchError }} />;
  if (keys.length === 0)
    return <StatementBand state={{ kind: 'empty' }} emptyKey="apiKeys:noKeys" />;
  return (
    <Box data-testid="api-keys-table">
      <Box sx={HEAD_ROW_SX} data-testid="api-keys-head">
        <Typography variant="overline" sx={HEAD_CELL_SX}>
          {t('colName')}
        </Typography>
        <Typography variant="overline" sx={HEAD_CELL_SX}>
          {t('created')}
        </Typography>
        <Typography variant="overline" sx={HEAD_CELL_SX}>
          {t('lastUsed')}
        </Typography>
        <Typography variant="overline" sx={HEAD_ACTS_SX}>
          {t('revoke')}
        </Typography>
      </Box>
      <Box sx={REVIEW_ROWS_SX} data-testid="api-keys-rows">
        {keys.map((k, index) => (
          <Fragment key={k.id}>
            {index > 0 ? <Divider component="div" sx={ROW_DIVIDER_SX} /> : null}
            <KeyReviewRow apiKey={k} onRevoke={onRevoke} />
          </Fragment>
        ))}
      </Box>
    </Box>
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

  const fetchError = keysError ?? null;
  const secretShowing =
    issueOutcome.kind === 'issued' ? <SecretShowing apiKey={issueOutcome.key} /> : null;

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
