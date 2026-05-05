import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import MuiLink from '@mui/material/Link';
import Tooltip from '@mui/material/Tooltip';
import BarChartIcon from '@mui/icons-material/BarChart';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { apiFetch, extractErrorMessage } from '../api/client';
import type { PublicLink } from '../api/types';

async function loadUserLinks(): Promise<[PublicLink[], string | null]> {
  try {
    const response = await apiFetch('/api/urls', 'get');
    return [response.data, null];
  } catch (err) {
    return [[], extractErrorMessage(err)];
  }
}

async function attemptShorten(url: string): Promise<[PublicLink | null, string | null]> {
  try {
    const link = await apiFetch('/api/urls', 'post', { body: { url } });
    return [link, null];
  } catch (err) {
    return [null, extractErrorMessage(err)];
  }
}

async function attemptDelete(slug: string): Promise<string | null> {
  try {
    await apiFetch('/api/urls/{slug}', 'delete', { pathParams: { slug } });
    return null;
  } catch (err) {
    return extractErrorMessage(err);
  }
}

const COL_WIDTH_SHORT_URL = 220;
const COL_WIDTH_DATE = 120;
const COL_WIDTH_ACTIONS = 152;
const ELLIPSIS_CELL_SX = { maxWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const };

function extractSlug(shortUrl: string): string {
  const parts = shortUrl.split('/');
  return parts[parts.length - 1] ?? shortUrl;
}

function copyToClipboard(text: string): void {
  if (!navigator.clipboard) return;
  void navigator.clipboard.writeText(text);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return iso.slice(0, 10);
}

interface NewLinkResultProps {
  link: PublicLink;
  onCopy: (text: string) => void;
}
function NewLinkResult({ link, onCopy }: NewLinkResultProps) {
  const copyBtn = (
    <IconButton size="small" onClick={() => onCopy(link.shortUrl)} data-testid="copy-link">
      <ContentCopyIcon fontSize="inherit" />
    </IconButton>
  );
  return (
    <Alert severity="success" sx={{ mt: 1 }} action={copyBtn} data-testid="new-link-alert">
      {link.shortUrl}
    </Alert>
  );
}

interface ShortenCardProps {
  urlInput: string;
  loading: boolean;
  error: string | null;
  newLink: PublicLink | null;
  onChange: (v: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCopy: (text: string) => void;
}
function ShortenCard({
  urlInput,
  onChange,
  onSubmit,
  loading,
  error,
  newLink,
  onCopy,
}: ShortenCardProps) {
  const { t } = useTranslation('dashboard');
  return (
    <Card data-testid="dashboard-shorten-card">
      <CardContent>
        <form onSubmit={onSubmit} data-testid="shorten-form">
          <TextField
            fullWidth
            label={t('longUrl')}
            value={urlInput}
            onChange={(e) => onChange(e.target.value)}
            inputProps={{ 'data-testid': 'shorten-url' }}
            required
          />
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            sx={{ mt: 1 }}
            data-testid="shorten-submit"
          >
            {t('shortenLabel')}
          </Button>
          {error && (
            <Alert severity="error" sx={{ mt: 1 }} data-testid="shorten-error">
              {error}
            </Alert>
          )}
          {newLink && <NewLinkResult link={newLink} onCopy={onCopy} />}
        </form>
      </CardContent>
    </Card>
  );
}

interface LinkTableRowProps {
  link: PublicLink;
  onCopy: (text: string) => void;
  onDelete: (slug: string) => void;
  onStats: (slug: string) => void;
}
function LinkTableRow({ link, onCopy, onDelete, onStats }: LinkTableRowProps) {
  const slug = extractSlug(link.shortUrl);
  const { t } = useTranslation('common');
  return (
    <TableRow data-testid={`link-row-${link.shortUrl}`} hover>
      <TableCell sx={ELLIPSIS_CELL_SX} title={link.shortUrl}>
        <MuiLink href={link.shortUrl} target="_blank" rel="noopener noreferrer" underline="hover">
          {link.shortUrl}
        </MuiLink>
      </TableCell>
      <TableCell sx={ELLIPSIS_CELL_SX} title={link.originalUrl}>
        {link.originalUrl}
      </TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(link.createdAt)}</TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(link.expiresAt)}</TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>
        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
          <Tooltip title={t('copy')}>
            <IconButton
              size="small"
              onClick={() => onCopy(link.shortUrl)}
              data-testid={`copy-${slug}`}
              aria-label={t('copy')}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('statsLabel', { ns: 'dashboard' })}>
            <IconButton
              size="small"
              onClick={() => onStats(slug)}
              data-testid={`stats-${slug}`}
              aria-label={t('statsLabel', { ns: 'dashboard' })}
            >
              <BarChartIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('delete')}>
            <IconButton
              size="small"
              onClick={() => onDelete(slug)}
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
  if (fetchError) return <Alert severity="error">{fetchError}</Alert>;
  if (links.length === 0)
    return <Typography data-testid="no-links-message">{t('noLinks')}</Typography>;
  return (
    <TableContainer component={Paper} variant="outlined" data-testid="dashboard-links-table">
      <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: COL_WIDTH_SHORT_URL }}>{t('shortUrl')}</TableCell>
            <TableCell>{t('originalUrl')}</TableCell>
            <TableCell sx={{ width: COL_WIDTH_DATE, whiteSpace: 'nowrap' }}>{t('createdAt')}</TableCell>
            <TableCell sx={{ width: COL_WIDTH_DATE, whiteSpace: 'nowrap' }}>{t('expiresAt')}</TableCell>
            <TableCell sx={{ width: COL_WIDTH_ACTIONS, textAlign: 'right' }}>{t('actions')}</TableCell>
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

interface DeleteDialogProps {
  candidate: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}
function DeleteDialog({ candidate, onConfirm, onCancel }: DeleteDialogProps) {
  const { t } = useTranslation('dashboard');
  return (
    <Dialog open={!!candidate} onClose={onCancel} data-testid="delete-dialog">
      <DialogTitle data-testid="delete-dialog-title">{t('deleteLink')}</DialogTitle>
      <DialogContent>
        <Typography>{t('deleteLinkBody', { slug: candidate ?? '' })}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} data-testid="delete-cancel">
          {t('cancel', { ns: 'common' })}
        </Button>
        <Button onClick={onConfirm} color="error" variant="contained" data-testid="delete-confirm">
          {t('delete', { ns: 'common' })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function DashboardPage() {
  const [links, setLinks] = useState<PublicLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);
  const [linksError, setLinksError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [shortenLoading, setShortenLoading] = useState(false);
  const [shortenError, setShortenError] = useState<string | null>(null);
  const [newLink, setNewLink] = useState<PublicLink | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    void loadUserLinks().then(([ls, err]) => {
      setLinks(ls);
      setLinksError(err);
      setLinksLoading(false);
    });
  }, [refreshCount]);

  const triggerRefresh = () => setRefreshCount((c) => c + 1);

  const handleShorten = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setShortenLoading(true);
    const [link, error] = await attemptShorten(urlInput);
    setNewLink(link);
    setShortenError(error);
    setShortenLoading(false);
    if (!error) {
      setUrlInput('');
      triggerRefresh();
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteCandidate) return;
    const error = await attemptDelete(deleteCandidate);
    setDeleteCandidate(null);
    if (error) {
      setShortenError(error);
      return;
    }
    triggerRefresh();
  };

  const handleCopy = (text: string) => copyToClipboard(text);
  const handleStats = (slug: string) => navigate(`/stats/${slug}`);

  return (
    <Stack spacing={4} data-testid="dashboard-page">
      <ShortenCard
        urlInput={urlInput}
        onChange={setUrlInput}
        onSubmit={handleShorten}
        loading={shortenLoading}
        error={shortenError}
        newLink={newLink}
        onCopy={handleCopy}
      />
      <LinksTable
        links={links}
        loading={linksLoading}
        fetchError={linksError}
        onCopy={handleCopy}
        onDelete={setDeleteCandidate}
        onStats={handleStats}
      />
      <DeleteDialog
        candidate={deleteCandidate}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteCandidate(null)}
      />
    </Stack>
  );
}
