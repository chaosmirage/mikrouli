import { useCallback, useMemo, useReducer, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MuiLink from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import type { Theme } from '@mui/material/styles';
import BarChartIcon from '@mui/icons-material/BarChart';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { apiFetch, extractErrorMessage } from '../api/client';
import { resolveFullShortUrl } from '../api/short-url';
import type { PublicLink } from '../api/types';
import ConfirmDialog from '../components/ConfirmDialog';
import CopyControl from '../components/CopyControl';
import ShortenCard from '../components/ShortenCard';
import StandingsRow from '../components/StandingsRow';
import { formatDate } from '../i18n/format';

async function loadUserLinks(): Promise<PublicLink[]> {
  const response = await apiFetch('/api/urls', 'get');
  return response.data;
}

async function attemptDelete(slug: string): Promise<void> {
  await apiFetch('/api/urls/{slug}', 'delete', { pathParams: { slug } });
}

async function attemptUpdate(slug: string, url: string): Promise<void> {
  await apiFetch('/api/urls/{slug}', 'patch', { pathParams: { slug }, body: { url } });
}

function extractSlug(shortUrl: string): string {
  const parts = shortUrl.split('/');
  return parts[parts.length - 1] ?? shortUrl;
}

// The narrowing is a pure derivation over the cached list: a remembered
// fragment (part of the slug or part of the destination) keeps only the
// links that carry it, case-insensitively. The list resource itself is
// never touched.
function narrowLinks(links: PublicLink[], fragment: string): PublicLink[] {
  const needle = fragment.trim().toLowerCase();
  if (!needle) return links;
  return links.filter(
    (link) =>
      extractSlug(link.shortUrl).toLowerCase().includes(needle) ||
      link.originalUrl.toLowerCase().includes(needle),
  );
}

// --- The in-row correction -------------------------------------------------

// One row corrects at a time; the phases are exclusive, so the state is a
// small discriminated shape reduced by one pure function.
interface CorrectionState {
  slug: string;
  phase: 'editing' | 'saving';
  error: string | null;
}

type CorrectionAction =
  | { type: 'open'; slug: string }
  | { type: 'saving' }
  | { type: 'refused'; message: string }
  | { type: 'close' };

function correctionReducer(
  state: CorrectionState | null,
  action: CorrectionAction,
): CorrectionState | null {
  switch (action.type) {
    case 'open':
      return { slug: action.slug, phase: 'editing', error: null };
    case 'saving':
      return state ? { ...state, phase: 'saving' } : state;
    case 'refused':
      return state ? { ...state, phase: 'editing', error: action.message } : state;
    case 'close':
      return null;
  }
}

interface DestinationCorrectionProps {
  slug: string;
  currentUrl: string;
  saving: boolean;
  error: string | null;
  onConfirm: (url: string) => void;
  onCancel: () => void;
}

// The destination cell while correcting: the entering opens on the
// destination as it stands, confirm and cancel stay inside the row, and a
// refused destination is stated in place so the owner can correct and
// confirm again — never silently lost.
function DestinationCorrection({
  slug,
  currentUrl,
  saving,
  error,
  onConfirm,
  onCancel,
}: DestinationCorrectionProps) {
  const { t } = useTranslation('dashboard');
  const { t: tCommon } = useTranslation('common');
  const [draft, setDraft] = useState(currentUrl);
  const inputProps = useMemo(() => ({ 'data-testid': `edit-url-input-${slug}` }), [slug]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setDraft(event.target.value),
    [],
  );
  const handleConfirm = useCallback(() => onConfirm(draft), [onConfirm, draft]);

  return (
    <Stack sx={CORRECTION_SX} useFlexGap>
      <TextField
        size="small"
        label={t('correctedDestination')}
        value={draft}
        onChange={handleChange}
        error={!!error}
        inputProps={inputProps}
        sx={CORRECTION_FIELD_SX}
        disabled={saving}
      />
      {error ? (
        <Typography
          variant="body2"
          sx={CORRECTION_ERROR_SX}
          role="alert"
          data-testid={`edit-error-${slug}`}
        >
          {error}
        </Typography>
      ) : null}
      <Stack direction="row" spacing={1}>
        <Button
          size="small"
          onClick={onCancel}
          disabled={saving}
          data-testid={`edit-cancel-${slug}`}
        >
          {tCommon('cancel')}
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={handleConfirm}
          disabled={saving}
          data-testid={`edit-confirm-${slug}`}
        >
          {tCommon('save')}
        </Button>
      </Stack>
    </Stack>
  );
}

// --- The set rows ----------------------------------------------------------

interface LinkSetRowProps {
  link: PublicLink;
  correction: CorrectionState | null;
  onOpenCorrection: (slug: string) => void;
  onConfirmCorrection: (slug: string, url: string) => void;
  onCancelCorrection: () => void;
  onStats: (slug: string) => void;
  onRetire: (slug: string) => void;
}

function LinkSetRow({
  link,
  correction,
  onOpenCorrection,
  onConfirmCorrection,
  onCancelCorrection,
  onStats,
  onRetire,
}: LinkSetRowProps) {
  const slug = extractSlug(link.shortUrl);
  const fullUrl = resolveFullShortUrl(link.shortUrl);
  const { t } = useTranslation('common');
  const { t: tDashboard } = useTranslation('dashboard');

  const handleStats = useCallback(() => onStats(slug), [onStats, slug]);
  const handleRetire = useCallback(() => onRetire(slug), [onRetire, slug]);
  const handleCorrect = useCallback(() => onOpenCorrection(slug), [onOpenCorrection, slug]);
  const handleConfirmCorrection = useCallback(
    (url: string) => onConfirmCorrection(slug, url),
    [onConfirmCorrection, slug],
  );

  const activeCorrection = correction?.slug === slug ? correction : null;
  const destinationValue =
    activeCorrection === null ? (
      <Typography component="span" sx={ELLIPSIS_SX} title={link.originalUrl}>
        {link.originalUrl}
      </Typography>
    ) : (
      <DestinationCorrection
        key={slug}
        slug={slug}
        currentUrl={link.originalUrl}
        saving={activeCorrection.phase === 'saving'}
        error={activeCorrection.error}
        onConfirm={handleConfirmCorrection}
        onCancel={onCancelCorrection}
      />
    );

  return (
    <StandingsRow
      rowTestId={`link-row-${slug}`}
      identity={
        <MuiLink
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
          sx={TECHNICAL_LINK_SX}
          title={fullUrl}
        >
          {fullUrl}
        </MuiLink>
      }
      standings={[
        { label: tDashboard('originalUrl'), value: destinationValue },
        {
          label: tDashboard('createdAt'),
          value: formatDate(link.createdAt),
          testId: `created-${slug}`,
        },
        {
          label: tDashboard('expiresAt'),
          value: formatDate(link.expiresAt),
          testId: `expires-${slug}`,
        },
      ]}
      acts={
        <>
          {/* The row's take: one CopyControl per row, so each take's landed
              confirmation stands inside its own row under a per-row address
              derived from the slug. */}
          <CopyControl value={fullUrl} testId={`copy-${slug}`} />
          <Tooltip title={tDashboard('statsLabel')}>
            <IconButton
              size="small"
              onClick={handleStats}
              data-testid={`stats-${slug}`}
              aria-label={tDashboard('statsLabel')}
            >
              <BarChartIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={tDashboard('editLabel')}>
            <IconButton
              size="small"
              onClick={handleCorrect}
              data-testid={`edit-${slug}`}
              aria-label={tDashboard('editLabel')}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('delete')}>
            <IconButton
              size="small"
              onClick={handleRetire}
              data-testid={`delete-${slug}`}
              aria-label={t('delete')}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      }
    />
  );
}

// --- The set ---------------------------------------------------------------

interface LinksSetProps {
  links: PublicLink[];
  fragment: string;
  onFragmentChange: (fragment: string) => void;
  loading: boolean;
  fetchError: string | null;
  correction: CorrectionState | null;
  onOpenCorrection: (slug: string) => void;
  onConfirmCorrection: (slug: string, url: string) => void;
  onCancelCorrection: () => void;
  onStats: (slug: string) => void;
  onRetire: (slug: string) => void;
}

function LinksSet({
  links,
  fragment,
  onFragmentChange,
  loading,
  fetchError,
  correction,
  onOpenCorrection,
  onConfirmCorrection,
  onCancelCorrection,
  onStats,
  onRetire,
}: LinksSetProps) {
  const { t } = useTranslation('dashboard');
  const narrowed = useMemo(() => narrowLinks(links, fragment), [links, fragment]);
  const isNarrowing = fragment.trim().length > 0;
  // Live narrowing: each entered fragment narrows immediately, no submit.
  const handleFragmentChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => onFragmentChange(event.target.value),
    [onFragmentChange],
  );

  if (loading) return <CircularProgress data-testid="dashboard-loading" />;
  if (fetchError)
    return (
      <Alert severity="error" data-testid="links-table-error">
        {fetchError}
      </Alert>
    );
  if (links.length === 0)
    return <Typography data-testid="no-links-message">{t('noLinks')}</Typography>;

  return (
    <Paper variant="outlined" data-testid="dashboard-links-set">
      <Box sx={SET_HEAD_SX}>
        <TextField
          size="small"
          fullWidth
          label={t('narrowLinks')}
          value={fragment}
          onChange={handleFragmentChange}
          inputProps={NARROW_INPUT_PROPS}
        />
      </Box>
      <Divider />
      {narrowed.length === 0 ? (
        <Box sx={SET_BODY_SX}>
          <Alert severity="info" data-testid="narrowed-empty">
            {t('narrowedEmpty', { fragment: fragment.trim() })}
          </Alert>
        </Box>
      ) : (
        <Stack
          key={fragment.toLowerCase()}
          sx={isNarrowing ? narrowedSetSx : ROWS_SX}
          divider={<Divider component="div" />}
          spacing={1.5}
          useFlexGap
        >
          {narrowed.map((link) => (
            <LinkSetRow
              key={link.shortUrl}
              link={link}
              correction={correction}
              onOpenCorrection={onOpenCorrection}
              onConfirmCorrection={onConfirmCorrection}
              onCancelCorrection={onCancelCorrection}
              onStats={onStats}
              onRetire={onRetire}
            />
          ))}
        </Stack>
      )}
    </Paper>
  );
}

// --- The page --------------------------------------------------------------

export default function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const queryClient = useQueryClient();
  const {
    data: links = [],
    error: linksError,
    isLoading: linksLoading,
  } = useQuery({
    queryKey: ['links'],
    queryFn: loadUserLinks,
  });
  const [pageError, setPageError] = useState<string | null>(null);
  const [fragment, setFragment] = useState('');
  const [retireCandidate, setRetireCandidate] = useState<string | null>(null);
  const [correction, dispatchCorrection] = useReducer(correctionReducer, null);
  const navigate = useNavigate();

  // The shared ShortenCard owns its input/loading/error/result state. The
  // dashboard just refreshes its links list when a shorten succeeds so the
  // new row appears in the set below.
  const handleShortened = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['links'] });
  }, [queryClient]);

  const handleRetireConfirm = useCallback(async () => {
    if (!retireCandidate) return;
    try {
      await attemptDelete(retireCandidate);
      setRetireCandidate(null);
      void queryClient.invalidateQueries({ queryKey: ['links'] });
    } catch (err) {
      setRetireCandidate(null);
      setPageError(extractErrorMessage(err));
    }
  }, [retireCandidate, queryClient]);

  const handleStats = useCallback((slug: string) => navigate(`/stats/${slug}`), [navigate]);
  const handleCancelRetire = useCallback(() => setRetireCandidate(null), []);

  const handleOpenCorrection = useCallback((slug: string) => {
    dispatchCorrection({ type: 'open', slug });
  }, []);
  const handleCancelCorrection = useCallback(() => {
    dispatchCorrection({ type: 'close' });
  }, []);
  // A refused destination keeps the correction open with the resolved
  // problem-details message, so the owner can correct and confirm again
  // while the previous destination still stands.
  const handleConfirmCorrection = useCallback(
    async (slug: string, url: string) => {
      dispatchCorrection({ type: 'saving' });
      try {
        await attemptUpdate(slug, url);
        dispatchCorrection({ type: 'close' });
        void queryClient.invalidateQueries({ queryKey: ['links'] });
      } catch (err) {
        dispatchCorrection({ type: 'refused', message: extractErrorMessage(err) });
      }
    },
    [queryClient],
  );

  const fetchError = linksError ? extractErrorMessage(linksError) : pageError;

  return (
    <Stack spacing={4} data-testid="dashboard-page">
      <ShortenCard namespace="dashboard" onShortened={handleShortened} />
      <LinksSet
        links={links}
        fragment={fragment}
        onFragmentChange={setFragment}
        loading={linksLoading}
        fetchError={fetchError}
        correction={correction}
        onOpenCorrection={handleOpenCorrection}
        onConfirmCorrection={handleConfirmCorrection}
        onCancelCorrection={handleCancelCorrection}
        onStats={handleStats}
        onRetire={setRetireCandidate}
      />
      <ConfirmDialog
        open={!!retireCandidate}
        title={t('deleteLink')}
        description={t('deleteLinkBody', { slug: retireCandidate ?? '' })}
        confirmLabel={t('delete', { ns: 'common' })}
        onConfirm={handleRetireConfirm}
        onCancel={handleCancelRetire}
        dialogTestId="delete-dialog"
        titleTestId="delete-dialog-title"
        cancelTestId="delete-cancel"
        confirmTestId="delete-confirm"
      />
    </Stack>
  );
}

// --- Style constants (hoisted; one identity for every render) --------------

// Tokens are consumed through the theme: the ink ladder and the technical
// register live in the theme factory, and the narrowing motion carries the
// transitions config's narrow duration.

const NARROW_ANIMATION_NAME = 'mikrouli-set-narrow';

// The narrowing's own motion: each further fragment re-mounts the rows so
// the shrinking set itself reads as the progress. The reduced-motion
// preference is owned by the theme's single centralized collapse
// (MuiCssBaseline in src/theme.ts), which turns this animation instant too.
const narrowedSetSx = (theme: Theme) => ({
  animation: `${NARROW_ANIMATION_NAME} ${theme.transitions.duration.narrow ?? 150}ms ${
    theme.transitions.easing.easeOut
  } both`,
  [`@keyframes ${NARROW_ANIMATION_NAME}`]: {
    from: { opacity: 0.35 },
    to: { opacity: 1 },
  },
});

const ROWS_SX = { pt: 1.5 } as const;

const SET_HEAD_SX = { p: 2, pb: 1.5 } as const;
const SET_BODY_SX = { p: 2 } as const;

const CORRECTION_SX = { gap: 1, minWidth: { xs: '100%', sm: 320 } } as const;
const CORRECTION_FIELD_SX = { minWidth: 0 } as const;
// A refused destination is stated in place with the entering it refused —
// severity by ink step, never a second hue.
const CORRECTION_ERROR_SX = { color: 'error.main' } as const;

const ELLIPSIS_SX = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: 360,
} as const;

// The short link reads in the fixed-width register so the character-exact
// string is read character-exactly. (The optional chain keeps the link
// legible under a theme that predates the register.)
const TECHNICAL_LINK_SX = {
  fontFamily: (theme: Theme) => theme.typography.technical?.fontFamily,
  wordBreak: 'break-all',
} as const;

const NARROW_INPUT_PROPS = { 'data-testid': 'narrow-links' } as const;
