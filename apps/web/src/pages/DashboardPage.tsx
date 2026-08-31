import { Fragment, useCallback, useMemo, useReducer, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import MuiLink from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import type { Theme } from '@mui/material/styles';
import { apiFetch, extractErrorMessage } from '../api/client';
import { resolveFullShortUrl } from '../api/short-url';
import type { PublicLink } from '../api/types';
import ConfirmDialog from '../components/ConfirmDialog';
import ShortenCard from '../components/ShortenCard';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
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

// The row reads the address as its owner shares it — host and slug, the
// scheme implied — while the link itself still resolves the full URL.
function displayAddress(fullUrl: string): string {
  return fullUrl.replace(/^https?:\/\//, '');
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
// destination as it stands, and it travels on one line with its confirm
// whenever the row has room — folding onto separate lines only when the row
// is narrow. The entering's accessible name rides on the input element
// itself (the set's head names the column). A refused destination is stated
// in place so the owner can correct and confirm again — never silently lost.
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
  const inputProps = useMemo(
    () => ({ 'data-testid': `edit-url-input-${slug}`, 'aria-label': t('correctedDestination') }),
    [slug, t],
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setDraft(event.target.value),
    [],
  );
  const handleConfirm = useCallback(() => onConfirm(draft), [onConfirm, draft]);

  return (
    <Stack direction="row" sx={CORRECTION_SX} useFlexGap data-testid={`edit-correction-${slug}`}>
      <TextField
        size="small"
        fullWidth
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
      <Stack direction="row" spacing={1} sx={CORRECTION_ACTS_SX}>
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

// --- The row's take ---------------------------------------------------------

// The take as the set's frame states it: a word in the accent ink, one
// activation, and the landing confirmed over it in the same glance — never a
// silent write. The confirmation floats above the word, so no landing ever
// shifts the row it stands in.
interface CopyActProps {
  value: string;
  testId: string;
}

function CopyAct({ value, testId }: CopyActProps) {
  const { t } = useTranslation('common');
  const { outcome, copy } = useCopyToClipboard();

  const handleTake = useCallback(() => copy(value), [copy, value]);
  const landed = outcome.status === 'landed';

  return (
    <Box sx={TAKE_ROOT_SX}>
      <Button size="small" onClick={handleTake} data-testid={testId} sx={COPY_ACT_SX}>
        {t('copy')}
      </Button>
      {outcome.status !== 'idle' && (
        <Box
          role="status"
          sx={landed ? CONFIRMATION_LANDED_SX : CONFIRMATION_FAILED_SX}
          data-testid={landed ? `${testId}-landed` : `${testId}-failed`}
        >
          {landed ? t('copied') : t('copyFailed')}
        </Box>
      )}
    </Box>
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
  const address = displayAddress(fullUrl);
  const { t } = useTranslation('dashboard');

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
      <Typography component="span" variant="body2" sx={DESTINATION_SX} title={link.originalUrl}>
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
    <Box sx={ROW_SX} data-testid={`link-row-${slug}`}>
      <MuiLink
        href={fullUrl}
        target="_blank"
        rel="noopener noreferrer"
        underline="hover"
        sx={TECHNICAL_LINK_SX}
        title={fullUrl}
      >
        {address}
      </MuiLink>
      {destinationValue}
      <Typography variant="body2" sx={META_SX} data-testid={`created-${slug}`}>
        {formatDate(link.createdAt)}
      </Typography>
      <Typography variant="body2" sx={META_SX} data-testid={`expires-${slug}`}>
        {formatDate(link.expiresAt)}
      </Typography>
      <Box sx={ACTS_SX}>
        <CopyAct value={fullUrl} testId={`copy-${slug}`} />
        <Button
          size="small"
          onClick={handleStats}
          data-testid={`stats-${slug}`}
          sx={SECONDARY_ACT_SX}
        >
          {t('statsLabel')}
        </Button>
        <Button
          size="small"
          onClick={handleCorrect}
          data-testid={`edit-${slug}`}
          sx={SECONDARY_ACT_SX}
        >
          {t('editLabel')}
        </Button>
        <Button
          size="small"
          onClick={handleRetire}
          data-testid={`delete-${slug}`}
          sx={MUTED_ACT_SX}
        >
          {t('retire')}
        </Button>
      </Box>
    </Box>
  );
}

// --- The set's head: one column-naming row ----------------------------------

interface SetHeadProps {
  columns: string[];
}

function SetHead({ columns }: SetHeadProps) {
  return (
    <Box sx={HEAD_ROW_SX} data-testid="dashboard-links-head">
      {columns.map((column, index) => (
        <Typography
          key={column}
          variant="overline"
          sx={index === columns.length - 1 ? HEAD_ACTS_SX : HEAD_CELL_SX}
        >
          {column}
        </Typography>
      ))}
    </Box>
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
    <Box data-testid="dashboard-links-set">
      <TextField
        size="small"
        hiddenLabel
        placeholder={t('narrowLinks')}
        value={fragment}
        onChange={handleFragmentChange}
        inputProps={NARROW_INPUT_PROPS}
        sx={NARROW_FIELD_SX}
      />
      {narrowed.length === 0 ? (
        <Box sx={SET_BODY_SX}>
          <Alert severity="info" data-testid="narrowed-empty">
            {t('narrowedEmpty', { fragment: fragment.trim() })}
          </Alert>
        </Box>
      ) : (
        <>
          <SetHead
            columns={[
              t('colShortLink'),
              t('colDestination'),
              t('colCreated'),
              t('colExpires'),
              t('colActs'),
            ]}
          />
          <Box
            key={fragment.toLowerCase()}
            sx={isNarrowing ? narrowedSetSx : ROWS_SX}
            data-testid="dashboard-links-rows"
          >
            {narrowed.map((link, index) => (
              <Fragment key={link.shortUrl}>
                {index > 0 ? <Divider component="div" flexItem /> : null}
                <LinkSetRow
                  link={link}
                  correction={correction}
                  onOpenCorrection={onOpenCorrection}
                  onConfirmCorrection={onConfirmCorrection}
                  onCancelCorrection={onCancelCorrection}
                  onStats={onStats}
                  onRetire={onRetire}
                />
              </Fragment>
            ))}
          </Box>
        </>
      )}
    </Box>
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
  // The open correction lives at the PAGE, not the row: no row re-render —
  // the responsive xs/md switch in these rows is pure CSS — can remount the
  // editor away, so an open correction survives any viewport change.
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

  // The confirmation names the address as its owner shares it — host and
  // slug — the same reading the row itself carries.
  const retireCandidateAddress = useMemo(() => {
    if (retireCandidate === null) return '';
    const link = links.find((candidate) => extractSlug(candidate.shortUrl) === retireCandidate);
    return link ? displayAddress(resolveFullShortUrl(link.shortUrl)) : retireCandidate;
  }, [retireCandidate, links]);

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
        title={t('deleteLink', { slug: retireCandidateAddress })}
        description={t('deleteLinkBody')}
        confirmLabel={t('retire')}
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

// The set's ONE shared row template: every track is a proportional fr share
// over a zero floor, so a track's width never depends on any row's (or the
// head's) own content — except the acts track, whose floor is a fixed
// measure (never its content), wide enough that the row's four act reaches
// hold one line at every width without driving the page wide. The head and
// every row carry this IDENTICAL template at the identical width and gap,
// so each column keeps one x from its head through every row.
const LINK_ROW_COLUMNS =
  'minmax(0, 2.2fr) minmax(0, 5fr) minmax(0, 1.5fr) minmax(0, 1.3fr) minmax(180px, 1.1fr)';

// The narrowing's own motion: each further fragment re-mounts the rows so
// the shrinking set itself reads as the progress. The box rhythm rides
// along (the animation is added to it, never traded for it). The
// reduced-motion preference is owned by the theme's single centralized
// collapse (MuiCssBaseline in src/theme.ts), which turns this animation
// instant too.
const narrowedSetSx = (theme: Theme) => ({
  ...ROWS_SX,
  animation: `${NARROW_ANIMATION_NAME} ${theme.transitions.duration.narrow ?? 150}ms ${
    theme.transitions.easing.easeOut
  } both`,
  [`@keyframes ${NARROW_ANIMATION_NAME}`]: {
    from: { opacity: 0.35 },
    to: { opacity: 1 },
  },
});

// The set's rows: a plain column of rows below md and at md alike — each
// ROW itself carries the head's identical template at the identical width,
// so the columns hold one line and like-positioned matter starts at the
// same x in every row. The row gap is the set's rhythm below md: rows apart
// by more than the label line height (Hermann separation); at md the rows
// carry their own vertical padding between the hairlines.
const ROWS_SX = {
  pt: 1.5,
  display: 'flex',
  flexDirection: 'column',
  rowGap: { xs: 3, md: 0 },
} as const;

// A row divider is the set's plain hairline between rows at md, and the
// cluster separator below md — never a grid participant.

// The set's head carries the same tracks the rows adopt, so each name sits
// over its column. The head stands at the set's head only from md up; the
// folded rows below md name nothing (each cluster reads by its matter).
const HEAD_ROW_SX = {
  display: { xs: 'none', md: 'grid' },
  gridTemplateColumns: { md: LINK_ROW_COLUMNS },
  columnGap: { md: 3 },
  alignItems: 'end',
  pb: 1,
  mt: 3,
} as const;

const HEAD_CELL_SX = { color: 'ink.secondary' } as const;
const HEAD_ACTS_SX = { color: 'ink.secondary', textAlign: 'right' } as const;

// One row of the set: from md up it carries the head's own identical
// template (same string, same gap, same width), so its matter reads on one
// line in the columns the head names; below md it folds into a cluster under
// the row's own matter, the readable shape when the row is narrow. The row's
// padding carries the set's vertical rhythm at md (rows apart beyond the
// label line height).
const ROW_SX = {
  display: { xs: 'flex', md: 'grid' },
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: 3,
  rowGap: 1.5,
  width: '100%',
  py: 2,
  gridTemplateColumns: { md: LINK_ROW_COLUMNS },
} as const;

// The row's meta standings (created, expiry) read at the meta size in the
// muted ink, in tabular figures.
const META_SX = {
  color: 'ink.muted',
  fontSize: '0.75rem',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
} as const;

// The row's act reaches: words, not icons — the take in the accent ink (the
// one accent-colored matter on the surface), the visits and the correction
// in the secondary ink, the retire in the muted ink. They end the row.
const ACTS_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  marginLeft: 'auto',
} as const;

const ACT_BASE_SX = { minWidth: 0, px: 0, py: 0.25 } as const;
const COPY_ACT_SX = { ...ACT_BASE_SX, color: 'primary.main' } as const;
const SECONDARY_ACT_SX = { ...ACT_BASE_SX, color: 'ink.secondary' } as const;
const MUTED_ACT_SX = { ...ACT_BASE_SX, color: 'ink.muted' } as const;

// The take's own ground: the control IS its word. The root's one job is to
// anchor the floating statement, so it takes a positioning context and
// sizes itself to the word alone — no confirmation matter ever widens or
// heightens the row the take stands in.
const TAKE_ROOT_SX = { position: 'relative', display: 'inline-flex' } as const;

// The confirmation's floating shape: the confirmed reading's quiet-bold
// weight on the raised surface, hairline edge, and the family's radius.
// Anchored above the word and stripped of pointer events, so it states the
// landing without occupying flow space or covering a sibling's click target.
const CONFIRMATION_BASE_SX = {
  position: 'absolute',
  bottom: (theme: Theme) => `calc(100% + ${theme.spacing(0.75)})`,
  left: 0,
  zIndex: 1,
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
  typography: 'body2',
  fontWeight: 600,
  padding: (theme: Theme) => theme.spacing(0.5, 1.25),
  borderRadius: (theme: Theme) => theme.shape.borderRadius,
  border: (theme: Theme) => `1px solid ${theme.palette.line.hairline}`,
  backgroundColor: (theme: Theme) => theme.palette.surface.raised,
  boxShadow: (theme: Theme) => theme.depth.hover,
} as const;

// The two readings of one take: the landed statement in the success ink, the
// refused statement in the error ink — one floating shape, two inks.
const CONFIRMATION_LANDED_SX = {
  ...CONFIRMATION_BASE_SX,
  color: (theme: Theme) => theme.palette.success.main,
} as const;
const CONFIRMATION_FAILED_SX = {
  ...CONFIRMATION_BASE_SX,
  color: (theme: Theme) => theme.palette.error.main,
} as const;

// The narrowing entering stands bare at the set's head, named by its
// placeholder alone: the filled control ground, the hairline edge, the
// control radius — the same entering the create act carries.
const NARROW_FIELD_SX = {
  width: { xs: '100%', md: '360px' },
  mt: 3,
  '& .MuiOutlinedInput-root': { backgroundColor: 'surface.raised' },
} as const;

const SET_BODY_SX = { pt: 2 } as const;

// The in-row correction lays out on one line — entering beside confirm —
// whenever the destination's track has room for both, and wraps each onto
// its own line only when the track is narrow. It is never a fixed-width
// island: the form is bounded by the track it renders in. The top margin is
// the ladder's inline step, so the entering's input never glues to the row
// line above it.
const CORRECTION_SX = {
  mt: 1,
  mb: 1,
  gap: 1,
  width: '100%',
  minWidth: 0,
  flexWrap: 'wrap',
  alignItems: 'center',
} as const;

// The entering fills whatever line the row gives it; minWidth 0 lets it
// shrink with the row instead of holding a fixed width, so a long
// destination value never expands or overflows the container.
const CORRECTION_FIELD_SX = { flex: '1 1 240px', minWidth: 0 } as const;

// Confirm and cancel travel as one unit: they share the entering's line on
// wide rows and wrap below it whole on narrow ones.
const CORRECTION_ACTS_SX = { flexShrink: 0 } as const;

// A refused destination is stated on the correction's own full-width line —
// severity by ink step, never a second hue.
const CORRECTION_ERROR_SX = { color: 'error.main', flexBasis: '100%' } as const;

// The standing destination reads in the secondary ink and wraps inside the
// row it occupies: a spaceless URL breaks anywhere rather than overflowing
// the row (or being clipped into a fixed-width island), with the full string
// still at hand on hover.
const DESTINATION_SX = { color: 'ink.secondary', overflowWrap: 'anywhere' } as const;

// The short link reads in the fixed-width register so the character-exact
// string is read character-exactly. (The optional chain keeps the link
// legible under a theme that predates the register.)
const TECHNICAL_LINK_SX = {
  fontFamily: (theme: Theme) => theme.typography.technical?.fontFamily,
  color: 'ink.primary',
  wordBreak: 'break-all',
} as const;

const NARROW_INPUT_PROPS = { 'data-testid': 'narrow-links' } as const;
