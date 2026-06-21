import { FormEvent, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { apiFetch, extractErrorMessage } from '../api/client';
import QrCode from './QrCode';
import type { PublicLink } from '../api/types';

// Hoisted style constants: module scope so every render reuses the same object
// identity (MUI sx prop). See material-best-practices: no inline object literals.
const SHORTEN_FIELD_SX = { flex: 1 } as const;
const SHORTEN_SUBMIT_SX = { whiteSpace: 'nowrap' } as const;
const NEW_LINK_ALERT_SX = { mt: 1 } as const;
const QR_CODE_STACK_SX = { mt: 2 } as const;
const SHORTEN_URL_INPUT_PROPS = { 'data-testid': 'shorten-url' } as const;

interface ShortenCardProps {
  // i18n namespace to resolve labels from. The dashboard namespace reuses the
  // existing dashboard.* keys; the landing namespace gets its own guestShorten*
  // keys. Pass-through keeps the component locale-agnostic.
  namespace: 'dashboard' | 'landing';
  // Fired after a successful shorten with the PublicLink returned by the API.
  // Hosts use it to trigger the sign-up nudge on the landing page; the
  // dashboard omits it (no nudge there).
  onShortened?: (link: PublicLink) => void;
}

// API stores `shortUrl` as a bare slug ("GYa6kx"); the public URL is produced
// by composing it with the current origin. Pre-resolved URLs (test fixtures,
// future API change) are passed through unchanged.
function resolveFullShortUrl(raw: string): string {
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw.trim();
  if (typeof window === 'undefined') return raw;
  const origin = window.location.origin;
  if (!origin || origin === 'null') return raw;
  return `${origin}/${raw}`;
}

function copyToClipboard(text: string): void {
  if (!navigator.clipboard) return;
  void navigator.clipboard.writeText(text);
}

async function attemptShorten(url: string): Promise<PublicLink> {
  return apiFetch('/api/urls', 'post', { body: { url } });
}

function NewLinkResult({ link }: { link: PublicLink }) {
  const fullUrl = resolveFullShortUrl(link.shortUrl);
  const handleCopyFull = useCallback(() => copyToClipboard(fullUrl), [fullUrl]);
  return (
    <Stack spacing={1.5}>
      <Alert
        severity="success"
        sx={NEW_LINK_ALERT_SX}
        action={
          <IconButton size="small" onClick={handleCopyFull} data-testid="copy-link">
            <ContentCopyIcon fontSize="inherit" />
          </IconButton>
        }
        data-testid="new-link-alert"
      >
        {fullUrl}
      </Alert>
      <Stack sx={QR_CODE_STACK_SX}>
        <QrCode value={fullUrl} />
      </Stack>
    </Stack>
  );
}

// Self-contained shorten form: owns its URL input, loading, error, and result
// state. Reused by DashboardPage (no callback) and LandingPage (with the
// sign-up nudge callback). The component is actor-agnostic — the API decides
// admission (Guest vs registered) based on whether the request carries a
// credential; this UI just POSTs to /api/urls.
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
            {newLink && <NewLinkResult link={newLink} />}
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}
