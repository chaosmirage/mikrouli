import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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
import Stack from '@mui/material/Stack';
import { ApiError, apiFetch, extractErrorMessage } from '../api/client';

interface DayClick {
  date: string;
  clicks: number;
}
interface CountryStat {
  name: string;
  clicks: number;
}
interface BrowserStat {
  name: string;
  clicks: number;
}

export interface Stats {
  totalClicks: number;
  clicksByDay: DayClick[];
  topCountries: CountryStat[];
  topBrowsers: BrowserStat[];
}

const HTTP_NOT_FOUND = 404;
const HTTP_FORBIDDEN = 403;

async function loadStats(slug: string): Promise<[Stats | null, string | null]> {
  try {
    return [await apiFetch<Stats>(`/api/stats/${slug}`), null];
  } catch (err) {
    if (err instanceof ApiError && err.status === HTTP_NOT_FOUND) return [null, 'No such link'];
    if (err instanceof ApiError && err.status === HTTP_FORBIDDEN)
      return [null, "You don't own this link"];
    return [null, extractErrorMessage(err)];
  }
}

interface StatRowProps {
  name: string;
  clicks: number;
}
function StatRow({ name, clicks }: StatRowProps) {
  return (
    <TableRow>
      <TableCell>{name}</TableCell>
      <TableCell align="right">{clicks}</TableCell>
    </TableRow>
  );
}

const NAME_CLICKS_HEAD = (
  <TableHead>
    <TableRow>
      <TableCell>Name</TableCell>
      <TableCell align="right">Clicks</TableCell>
    </TableRow>
  </TableHead>
);
const DATE_CLICKS_HEAD = (
  <TableHead>
    <TableRow>
      <TableCell>Date</TableCell>
      <TableCell align="right">Clicks</TableCell>
    </TableRow>
  </TableHead>
);

interface SimpleTableProps {
  title: string;
  rows: Array<{ name: string; clicks: number }>;
  testId?: string;
}
function SimpleTable({ title, rows, testId }: SimpleTableProps) {
  const body = (
    <TableBody>
      {rows.map((r) => (
        <StatRow key={r.name} name={r.name} clicks={r.clicks} />
      ))}
    </TableBody>
  );
  const table = (
    <TableContainer component={Paper}>
      <Table size="small">
        {NAME_CLICKS_HEAD}
        {body}
      </Table>
    </TableContainer>
  );
  return (
    <Stack spacing={1} data-testid={testId}>
      <Typography variant="h6">{title}</Typography>
      {table}
    </Stack>
  );
}

interface DayTableProps {
  rows: DayClick[];
}
function DayTable({ rows }: DayTableProps) {
  const body = (
    <TableBody>
      {rows.map((r) => (
        <StatRow key={r.date} name={r.date} clicks={r.clicks} />
      ))}
    </TableBody>
  );
  const table = (
    <TableContainer component={Paper}>
      <Table size="small">
        {DATE_CLICKS_HEAD}
        {body}
      </Table>
    </TableContainer>
  );
  return (
    <Stack spacing={1} data-testid="stats-days-section">
      <Typography variant="h6">Clicks over time</Typography>
      {table}
    </Stack>
  );
}

interface StatsViewProps {
  slug: string;
  stats: Stats;
}
function StatsView({ slug, stats }: StatsViewProps) {
  return (
    <Stack spacing={3} data-testid="stats-view">
      <Typography variant="h4" data-testid="stats-slug">
        {slug}
      </Typography>
      <Typography data-testid="stats-total">Total clicks: {stats.totalClicks}</Typography>
      <DayTable rows={stats.clicksByDay} />
      <SimpleTable
        title="Top countries"
        rows={stats.topCountries}
        testId="stats-countries-section"
      />
      <SimpleTable title="Top browsers" rows={stats.topBrowsers} testId="stats-browsers-section" />
    </Stack>
  );
}

export default function StatsPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadStats(slug).then(([s, err]) => {
      setStats(s);
      setError(err);
      setLoading(false);
    });
  }, [slug]);

  if (loading) return <CircularProgress data-testid="stats-loading" />;
  if (error)
    return (
      <Alert severity="error" data-testid="stats-error">
        {error}
      </Alert>
    );
  if (!stats) return <Alert severity="warning">No stats available</Alert>;
  return <StatsView slug={slug} stats={stats} />;
}
