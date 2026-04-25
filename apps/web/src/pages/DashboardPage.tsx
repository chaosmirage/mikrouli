import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import BarChartIcon from '@mui/icons-material/BarChart';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { apiFetch, extractErrorMessage } from '../api/client';

export interface LinkData {
  shortUrl: string;
  originalUrl: string;
  createdAt: string;
  expiresAt: string | null;
}

async function loadUserLinks(): Promise<[LinkData[], string | null]> {
  try {
    return [await apiFetch<LinkData[]>('/api/urls'), null];
  } catch (err) {
    return [[], extractErrorMessage(err)];
  }
}

async function attemptShorten(url: string): Promise<[LinkData | null, string | null]> {
  try {
    const link = await apiFetch<LinkData>('/api/urls', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
    return [link, null];
  } catch (err) {
    return [null, extractErrorMessage(err)];
  }
}

async function attemptDelete(slug: string): Promise<string | null> {
  try {
    await apiFetch<void>(`/api/urls/${slug}`, { method: 'DELETE' });
    return null;
  } catch (err) {
    return extractErrorMessage(err);
  }
}

function extractSlug(shortUrl: string): string {
  const parts = shortUrl.split('/');
  return parts[parts.length - 1] ?? shortUrl;
}

function copyToClipboard(text: string): void {
  if (!navigator.clipboard) return;
  void navigator.clipboard.writeText(text);
}

interface NewLinkResultProps {
  link: LinkData;
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
  newLink: LinkData | null;
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
  return (
    <Card data-testid="dashboard-shorten-card">
      <CardContent>
        <form onSubmit={onSubmit} data-testid="shorten-form">
          <TextField
            fullWidth
            label="Long URL"
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
            Shorten
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
  link: LinkData;
  onDelete: (slug: string) => void;
  onStats: (slug: string) => void;
}
function LinkTableRow({ link, onDelete, onStats }: LinkTableRowProps) {
  const slug = extractSlug(link.shortUrl);
  const createdDate = link.createdAt.slice(0, 10);
  const expiresText = link.expiresAt ? link.expiresAt.slice(0, 10) : '—';
  return (
    <TableRow data-testid={`link-row-${link.shortUrl}`}>
      <TableCell>{link.shortUrl}</TableCell>
      <TableCell>{link.originalUrl}</TableCell>
      <TableCell>{createdDate}</TableCell>
      <TableCell>{expiresText}</TableCell>
      <TableCell>
        <IconButton size="small" onClick={() => onStats(slug)} data-testid={`stats-${slug}`}>
          <BarChartIcon fontSize="small" />
        </IconButton>
      </TableCell>
      <TableCell>
        <IconButton size="small" onClick={() => onDelete(slug)} data-testid={`delete-${slug}`}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}

interface LinksTableProps {
  links: LinkData[];
  loading: boolean;
  fetchError: string | null;
  onDelete: (slug: string) => void;
  onStats: (slug: string) => void;
}
function LinksTable({ links, loading, fetchError, onDelete, onStats }: LinksTableProps) {
  if (loading) return <CircularProgress data-testid="dashboard-loading" />;
  if (fetchError) return <Alert severity="error">{fetchError}</Alert>;
  if (links.length === 0)
    return <Typography data-testid="no-links-message">No links yet — shorten one above</Typography>;
  return (
    <TableContainer component={Paper} data-testid="dashboard-links-table">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Short URL</TableCell>
            <TableCell>Original URL</TableCell>
            <TableCell>Created</TableCell>
            <TableCell>Expires</TableCell>
            <TableCell>Stats</TableCell>
            <TableCell>Delete</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {links.map((link) => (
            <LinkTableRow key={link.shortUrl} link={link} onDelete={onDelete} onStats={onStats} />
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
  const cancelBtn = (
    <Button onClick={onCancel} data-testid="delete-cancel">
      Cancel
    </Button>
  );
  const confirmBtn = (
    <Button onClick={onConfirm} color="error" variant="contained" data-testid="delete-confirm">
      Delete
    </Button>
  );
  return (
    <Dialog open={!!candidate} onClose={onCancel} data-testid="delete-dialog">
      <DialogTitle data-testid="delete-dialog-title">Delete link?</DialogTitle>
      <DialogContent>
        <Typography>This will permanently delete {candidate}.</Typography>
      </DialogContent>
      <DialogActions>
        {cancelBtn}
        {confirmBtn}
      </DialogActions>
    </Dialog>
  );
}

export default function DashboardPage() {
  const [links, setLinks] = useState<LinkData[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);
  const [linksError, setLinksError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [shortenLoading, setShortenLoading] = useState(false);
  const [shortenError, setShortenError] = useState<string | null>(null);
  const [newLink, setNewLink] = useState<LinkData | null>(null);
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

  const shortenCard = (
    <ShortenCard
      urlInput={urlInput}
      onChange={setUrlInput}
      onSubmit={handleShorten}
      loading={shortenLoading}
      error={shortenError}
      newLink={newLink}
      onCopy={handleCopy}
    />
  );
  const linksTable = (
    <LinksTable
      links={links}
      loading={linksLoading}
      fetchError={linksError}
      onDelete={setDeleteCandidate}
      onStats={handleStats}
    />
  );
  const dialog = (
    <DeleteDialog
      candidate={deleteCandidate}
      onConfirm={handleDeleteConfirm}
      onCancel={() => setDeleteCandidate(null)}
    />
  );

  return (
    <Stack spacing={4} data-testid="dashboard-page">
      {shortenCard}
      {linksTable}
      {dialog}
    </Stack>
  );
}
