import { FormEvent, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import { apiFetch, extractErrorMessage } from '../api/client';
import { resolveFullShortUrl } from '../api/short-url';
import QrCode from './QrCode';
import CopyControl from './CopyControl';
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

interface ShortenCardProps {
  // i18n namespace to resolve labels from. The dashboard namespace reuses the
  // existing dashboard.* keys; the landing namespace gets its own guestShorten*
  // keys. Pass-through keeps the component locale-agnostic.
  namespace: 'dashboard' | 'landing';
  // Fired after a successful shorten with the PublicLink returned by the API.
  // Hosts use it to stage the register nudge after the value on the guest
  // landing; the dashboard host passes it for its own list refresh.
  onShortened?: (link: PublicLink) => void;
}

async function attemptShorten(url: string): Promise<PublicLink> {
  return apiFetch('/api/urls', 'post', { body: { url } });
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
      <Alert severity="success" data-testid="result-confirmation">
        {t('resultCreated')}
      </Alert>
      <Stack sx={RESULT_TAKING_ROW_SX}>
        <Typography component="div" data-testid="result-link" sx={RESULT_LINK_SX}>
          {fullUrl}
        </Typography>
        <CopyControl value={fullUrl} />
      </Stack>
      <Stack sx={RESULT_CODE_CLUSTER_SX}>
        <QrCode value={fullUrl} />
      </Stack>
    </Stack>
  );
}

// Self-contained shorten form: owns its URL input, loading, error, and result
// state. Reused by DashboardPage and LandingPage. The component is
// actor-agnostic — the API decides admission (Guest vs registered) based on
// whether the request carries a credential; this UI just POSTs to /api/urls.
export default function ShortenCard({ namespace, onShortened }: ShortenCardProps) {
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

  return (
    <Card data-testid="dashboard-shorten-card">
      <CardContent>
        <form onSubmit={handleSubmit} data-testid="shorten-form">
          <Stack spacing={1.5}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              alignItems={{ sm: 'center' }}
            >
              <TextField
                label={t(labelKey)}
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
      </CardContent>
    </Card>
  );
}
