import { FormEvent, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import { apiFetch, extractErrorMessage } from '../api/client';
import { resolveFullShortUrl } from '../api/short-url';
import QrCode from './QrCode';
import CopyControl from './CopyControl';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import type { PublicLink } from '../api/types';
import type { Theme } from '@mui/material/styles';

// Static sx objects hoisted to module scope so every render reuses one object
// identity (MUI re-renders on sx reference change).
const SHORTEN_FIELD_SX = { flex: 1 } as const;
const SHORTEN_SUBMIT_SX = { whiteSpace: 'nowrap' } as const;
const SHORTEN_URL_INPUT_PROPS = { 'data-testid': 'shorten-url' } as const;

// The short address reads in the theme's fixed-width technical register: a
// character-exact string must be read character-exactly, because a mistyped
// address fails late. (The optional chain keeps the address legible under a
// theme that predates the register.)
const RESULT_LINK_SX = {
  fontFamily: (theme: Theme) => theme.typography.technical?.fontFamily,
  wordBreak: 'break-all',
  minWidth: 0,
} as const;

// Result-moment zoning: the taking row wraps to keep address + control in one
// glance at every width, and the code cluster stands a block gap below the
// confirmation so the two readings never fuse.
const RESULT_TAKING_ROW_SX = {
  flexWrap: 'wrap',
  rowGap: 1,
  columnGap: 1.5,
  alignItems: 'center',
} as const;
const RESULT_CODE_CLUSTER_SX = { mt: 3 } as const;

// --- The guest landing's result moment (frame S2) ---------------------------------
//
// The frame stages the moment as the page's whole composition, not a block
// inside the act column: the confirmation and the takeable address hold the
// content margin in a 360px taking zone, and the code cluster stands to their
// right on its own axis — the center of the region the taking row leaves free
// (frame 5:301: cluster spans 734..1067 on a 1200px zone). The cluster's own
// geometry is the shared QrCode restyled to the frame register from this host
// (the component stays the single owner of the code and its exports).

// The moment's two zones side by side at reading width, stacked under it below.
const MOMENT_ROOT_SX = {
  display: 'flex',
  flexDirection: { xs: 'column', md: 'row' },
  alignItems: { xs: 'stretch', md: 'flex-start' },
} as const;

// The taking zone: exactly the left 360px the frame gives the statement and
// the address, so the code zone's center stays on the frame's axis.
const MOMENT_TAKING_ZONE_SX = { width: { xs: '100%', md: '360px' } } as const;

// The confirmation is ONE accent statement line on the canvas — no band, no
// icon; the accent ink alone carries the landing (frame S2-B1: 16/24 primary).
const MOMENT_CONFIRMATION_SX = { color: 'primary.main' } as const;

// One glance, one row: the address reads at the technical register's 18px step
// and the take stands beside it (frame S2-B1: 24px below the confirmation).
const MOMENT_TAKING_ROW_SX = {
  mt: '24px',
  flexDirection: { xs: 'column', sm: 'row' },
  alignItems: { sm: 'center' },
  columnGap: 3,
  rowGap: 1.5,
} as const;
const MOMENT_LINK_SX = {
  fontFamily: (theme: Theme) => theme.typography.technical?.fontFamily,
  fontSize: '18px',
  lineHeight: '20px',
  wordBreak: 'break-all',
  minWidth: 0,
  color: 'text.primary',
} as const;

// The code zone centers the cluster on its own axis; the frame sets the code's
// top 140px below the confirmation line (frame 5:301: 270 vs 130).
const MOMENT_CODE_ZONE_SX = {
  flex: { md: '1 1 auto' },
  display: 'flex',
  justifyContent: 'center',
  pt: { xs: 3, md: '140px' },
} as const;

// The cluster register restyled from the host: the shared QrCode keeps its own
// stacking; these frame-scoped overrides set the frame's cluster geometry —
// the code 180px with the export pair one 20px step under it at a 24px pair
// pitch, both controls at the act family's 40px height and 14px step.
const MOMENT_CODE_CLUSTER_SX = {
  '& .MuiStack-root': { gap: 0 },
  '& .MuiStack-root > .MuiBox-root + .MuiBox-root': { marginTop: 0 },
  '& [data-testid="qr-code"]': { marginBottom: '20px' },
  '& [data-testid="qr-download-svg"]': { marginLeft: '24px' },
  '& .MuiButton-root': { height: 40, paddingInline: '16px', fontSize: '0.875rem' },
} as const;

// The take as the frame states it: one outlined pill labeled with its act, and
// the landed confirmation standing beside it in the accent ink — never silent,
// never a reflow (the caption mounts only after the take resolves).
const TAKE_BUTTON_SX = { height: 40, paddingInline: '16px', fontSize: '0.875rem' } as const;
const TAKE_STATEMENT_SX = {
  ml: '40px',
  fontSize: '0.75rem',
  color: 'primary.main',
  whiteSpace: 'nowrap',
} as const;

interface ShortenCardProps {
  // i18n namespace to resolve labels from. The dashboard namespace reuses the
  // existing dashboard.* keys; the landing namespace gets its own guestShorten*
  // keys. Pass-through keeps the component locale-agnostic.
  namespace: 'dashboard' | 'landing';
  // bare: render the entering row without the card chrome — the landing's
  // one-act row stands directly on the canvas (design S1-B2); the dashboard
  // keeps the card surface. The bare host also stages its result moment in the
  // landing frame register (S2); the card host keeps the contained register.
  bare?: boolean;
  // Fired after a successful shorten with the PublicLink returned by the API.
  // Hosts use it to stage the register nudge after the value on the guest
  // landing; the dashboard host passes it for its own list refresh.
  onShortened?: (link: PublicLink) => void;
}

async function attemptShorten(url: string): Promise<PublicLink> {
  return apiFetch('/api/urls', 'post', { body: { url } });
}

// The landing's take: the address row's one act, in the frame's S2 register —
// a labeled pill (the guest host states the act in words) with the landed
// statement beside it in the same glance.
function LandingTakeControl({ value }: { value: string }) {
  const { t } = useTranslation(['common', 'landing']);
  const { outcome, copy } = useCopyToClipboard();
  const landed = outcome.status === 'landed';

  const handleTake = useCallback(() => copy(value), [copy, value]);

  return (
    <Stack direction="row" alignItems="center">
      <Button
        variant="outlined"
        onClick={handleTake}
        data-testid="copy-link"
        aria-label={t('common:copy')}
        sx={TAKE_BUTTON_SX}
      >
        {t('common:copy')}
      </Button>
      {outcome.status !== 'idle' && (
        <Typography
          component="span"
          role="status"
          data-testid={landed ? 'copy-link-landed' : 'copy-link-failed'}
          sx={TAKE_STATEMENT_SX}
        >
          {landed ? t('landing:guestShortenCopied') : t('common:copyFailed')}
        </Typography>
      )}
    </Stack>
  );
}

// The guest landing's create-result moment (frame S2): the confirmation that
// the link exists, the short address as takeable text with one-activation copy,
// and the code cluster on its own axis — the register offer belongs to the
// host, which stages it after this moment, never inside it.
function LandingResultMoment({ link }: { link: PublicLink }) {
  const { t } = useTranslation('landing');
  const fullUrl = resolveFullShortUrl(link.shortUrl);

  return (
    // The root carries the preserved `new-link-alert` address verbatim — the
    // address the e2e shorten flow has always driven — while the finer
    // confirmation/link addresses live on its children.
    <Box data-testid="new-link-alert" sx={MOMENT_ROOT_SX}>
      <Box sx={MOMENT_TAKING_ZONE_SX}>
        <Typography
          variant="body"
          component="div"
          data-testid="result-confirmation"
          sx={MOMENT_CONFIRMATION_SX}
        >
          {t('guestResultCreated')}
        </Typography>
        <Stack sx={MOMENT_TAKING_ROW_SX}>
          <Typography component="div" data-testid="result-link" sx={MOMENT_LINK_SX}>
            {fullUrl}
          </Typography>
          <LandingTakeControl value={fullUrl} />
        </Stack>
      </Box>
      <Box sx={MOMENT_CODE_ZONE_SX}>
        <Box sx={MOMENT_CODE_CLUSTER_SX}>
          <QrCode value={fullUrl} size={180} />
        </Box>
      </Box>
    </Box>
  );
}

// The create-result moment: the confirmation that the link exists, the short
// address as takeable text with one-activation copy and its landed
// confirmation, and the QR block with both export formats. The register offer
// belongs to the guest host, which stages it after this moment — never inside
// it — so the ask always stands after the value.
function ResultMoment({ link }: { link: PublicLink }) {
  const { t } = useTranslation('common');
  const fullUrl = resolveFullShortUrl(link.shortUrl);

  return (
    // The root carries the preserved `new-link-alert` address verbatim — the
    // address the e2e shorten flow has always driven — while the finer
    // confirmation/link addresses live on its children.
    <Stack spacing={2} data-testid="new-link-alert">
      <Typography data-testid="result-confirmation" sx={{ color: 'primary.main' }}>
        {t('resultCreated')}
      </Typography>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={RESULT_TAKING_ROW_SX}>
        <Typography component="div" data-testid="result-link" sx={RESULT_LINK_SX}>
          {fullUrl}
        </Typography>
        <CopyControl value={fullUrl} />
      </Stack>
      <Stack sx={RESULT_CODE_CLUSTER_SX} alignItems="center">
        <QrCode value={fullUrl} />
      </Stack>
    </Stack>
  );
}

// Self-contained shorten form: owns its URL input, loading, error, and result
// state. Reused by DashboardPage and LandingPage. The component is
// actor-agnostic — the API decides admission (Guest vs registered) based on
// whether the request carries a credential; this UI just POSTs to /api/urls.
export default function ShortenCard({ namespace, onShortened, bare = false }: ShortenCardProps) {
  const { t } = useTranslation(namespace);
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newLink, setNewLink] = useState<PublicLink | null>(null);

  const labelKey = namespace === 'landing' ? 'guestShortenPlaceholder' : 'longUrl';
  const buttonKey = namespace === 'landing' ? 'guestShortenButton' : 'shortenLabel';

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setUrlInput(e.target.value),
    [],
  );

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setLoading(true);
      try {
        const link = await attemptShorten(urlInput);
        setNewLink(link);
        setError(null);
        setUrlInput('');
        onShortened?.(link);
      } catch (err) {
        setError(extractErrorMessage(err));
      }
      setLoading(false);
    },
    [urlInput, onShortened],
  );

  // The guest landing's moment replaces its entering row: the frame's result
  // composition IS the page (S2 has no second act beside the value), so once
  // the link exists the bare host renders the moment alone.
  const form =
    bare && newLink ? (
      <form onSubmit={handleSubmit} data-testid="shorten-form">
        <LandingResultMoment link={newLink} />
      </form>
    ) : (
      <form onSubmit={handleSubmit} data-testid="shorten-form">
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems={{ sm: 'center' }}
          >
            <TextField
              label={bare ? undefined : t(labelKey)}
              placeholder={bare ? t(labelKey) : undefined}
              value={urlInput}
              onChange={handleChange}
              inputProps={SHORTEN_URL_INPUT_PROPS}
              required
              sx={SHORTEN_FIELD_SX}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              data-testid="shorten-submit"
              sx={SHORTEN_SUBMIT_SX}
            >
              {t(buttonKey)}
            </Button>
          </Stack>
          {error && (
            <Alert severity="error" data-testid="shorten-error">
              {error}
            </Alert>
          )}
          {newLink && <ResultMoment link={newLink} />}
        </Stack>
      </form>
    );
  return bare ? (
    form
  ) : (
    <Card data-testid="dashboard-shorten-card">
      <CardContent>{form}</CardContent>
    </Card>
  );
}
