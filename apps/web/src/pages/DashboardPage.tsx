import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
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
import MuiLink from '@mui/material/Link';
import Tooltip from '@mui/material/Tooltip';
import BarChartIcon from '@mui/icons-material/BarChart';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { apiFetch, extractErrorMessage } from '../api/client';
import type { PublicLink } from '../api/types';
import ConfirmDialog from '../components/ConfirmDialog';
import ShortenCard from '../components/ShortenCard';

async function loadUserLinks(): Promise<PublicLink[]> {
  const response = await apiFetch('/api/urls', 'get');
  return response.data;
}

async function attemptDelete(slug: string): Promise<void> {
  await apiFetch('/api/urls/{slug}', 'delete', { pathParams: { slug } });
}

const COL_WIDTH_SHORT_URL = 220;
const COL_WIDTH_DATE = 120;
const COL_WIDTH_ACTIONS = 152;
const ELLIPSIS_CELL_SX = {
  maxWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
};

const TABLE_LAYOUT_SX = { tableLayout: 'fixed', width: '100%' } as const;
const NOWRAP_CELL_SX = { whiteSpace: 'nowrap' } as const;
const COL_WIDTH_DATE_SX = { width: COL_WIDTH_DATE, whiteSpace: 'nowrap' } as const;
const COL_WIDTH_SHORT_URL_SX = { width: COL_WIDTH_SHORT_URL } as const;
const COL_WIDTH_ACTIONS_SX = { width: COL_WIDTH_ACTIONS, textAlign: 'right' } as const;

function extractSlug(shortUrl: string): string {
  const parts = shortUrl.split('/');
  return parts[parts.length - 1] ?? shortUrl;
}

// API stores `shortUrl` as a bare slug ("GYa6kx") — the public URL is
// produced by composing it with the current origin. Pre-resolved URLs
// (test fixtures, future API change) are passed through unchanged.
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

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return iso.slice(0, 10);
}

interface LinkTableRowProps {
  link: PublicLink;
  onCopy: (text: string) => void;
  onDelete: (slug: string) => void;
  onStats: (slug: string) => void;
}
function LinkTableRow({ link, onCopy, onDelete, onStats }: LinkTableRowProps) {
  const slug = extractSlug(link.shortUrl);
  const fullUrl = resolveFullShortUrl(link.shortUrl);
  const { t } = useTranslation('common');
  const handleCopy = useCallback(() => onCopy(fullUrl), [onCopy, fullUrl]);
  const handleStats = useCallback(() => onStats(slug), [onStats, slug]);
  const handleDelete = useCallback(() => onDelete(slug), [onDelete, slug]);
  return (
    <TableRow data-testid={`link-row-${slug}`} hover>
      <TableCell sx={ELLIPSIS_CELL_SX} title={fullUrl}>
        <MuiLink href={fullUrl} target="_blank" rel="noopener noreferrer" underline="hover">
          {fullUrl}
        </MuiLink>
      </TableCell>
      <TableCell sx={ELLIPSIS_CELL_SX} title={link.originalUrl}>
        {link.originalUrl}
      </TableCell>
      <TableCell sx={NOWRAP_CELL_SX}>{formatDate(link.createdAt)}</TableCell>
      <TableCell sx={NOWRAP_CELL_SX}>{formatDate(link.expiresAt)}</TableCell>
      <TableCell sx={NOWRAP_CELL_SX}>
        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
          <Tooltip title={t('copy')}>
            <IconButton
              size="small"
              onClick={handleCopy}
              data-testid={`copy-${slug}`}
              aria-label={t('copy')}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('statsLabel', { ns: 'dashboard' })}>
            <IconButton
              size="small"
              onClick={handleStats}
              data-testid={`stats-${slug}`}
              aria-label={t('statsLabel', { ns: 'dashboard' })}
            >
              <BarChartIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('delete')}>
            <IconButton
              size="small"
              onClick={handleDelete}
              data-testid={`delete-${slug}`}
              aria-label={t('delete')}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </TableCell>
    </TableRow>
  );
}

interface LinksTableProps {
  links: PublicLink[];
  loading: boolean;
  fetchError: string | null;
  onCopy: (text: string) => void;
  onDelete: (slug: string) => void;
  onStats: (slug: string) => void;
}
function LinksTable({ links, loading, fetchError, onCopy, onDelete, onStats }: LinksTableProps) {
  const { t } = useTranslation('dashboard');
  if (loading) return <CircularProgress data-testid="dashboard-loading" />;
  if (fetchError) return <Alert severity="error" data-testid="links-table-error">{fetchError}</Alert>;
  if (links.length === 0)
    return <Typography data-testid="no-links-message">{t('noLinks')}</Typography>;
  return (
    <TableContainer component={Paper} variant="outlined" data-testid="dashboard-links-table">
      <Table size="small" sx={TABLE_LAYOUT_SX}>
        <TableHead>
          <TableRow>
            <TableCell sx={COL_WIDTH_SHORT_URL_SX}>{t('shortUrl')}</TableCell>
            <TableCell>{t('originalUrl')}</TableCell>
            <TableCell sx={COL_WIDTH_DATE_SX}>{t('createdAt')}</TableCell>
            <TableCell sx={COL_WIDTH_DATE_SX}>{t('expiresAt')}</TableCell>
            <TableCell sx={COL_WIDTH_ACTIONS_SX}>{t('actions')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {links.map((link) => (
            <LinkTableRow
              key={link.shortUrl}
              link={link}
              onCopy={onCopy}
              onDelete={onDelete}
              onStats={onStats}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

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
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);
  const navigate = useNavigate();

  // The shared ShortenCard owns its input/loading/error/result state. The
  // dashboard just refreshes its links list when a shorten succeeds so the
  // new row appears in the table below.
  const handleShortened = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['links'] });
  }, [queryClient]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteCandidate) return;
    try {
      await attemptDelete(deleteCandidate);
      setDeleteCandidate(null);
      void queryClient.invalidateQueries({ queryKey: ['links'] });
    } catch (err) {
      setDeleteCandidate(null);
      setPageError(extractErrorMessage(err));
    }
  }, [deleteCandidate, queryClient]);

  const handleCopy = useCallback((text: string) => copyToClipboard(text), []);
  const handleStats = useCallback((slug: string) => navigate(`/stats/${slug}`), [navigate]);
  const handleCancelDelete = useCallback(() => setDeleteCandidate(null), []);

  const fetchError = linksError ? extractErrorMessage(linksError) : pageError;

  return (
    <Stack spacing={4} data-testid="dashboard-page">
      <ShortenCard namespace="dashboard" onShortened={handleShortened} />
      <LinksTable
        links={links}
        loading={linksLoading}
        fetchError={fetchError}
        onCopy={handleCopy}
        onDelete={setDeleteCandidate}
        onStats={handleStats}
      />
      <ConfirmDialog
        open={!!deleteCandidate}
        title={t('deleteLink')}
        description={t('deleteLinkBody', { slug: deleteCandidate ?? '' })}
        confirmLabel={t('delete', { ns: 'common' })}
        onConfirm={handleDeleteConfirm}
        onCancel={handleCancelDelete}
        dialogTestId="delete-dialog"
        titleTestId="delete-dialog-title"
        cancelTestId="delete-cancel"
        confirmTestId="delete-confirm"
      />
    </Stack>
  );
}
