import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { ApiError, apiFetch } from '../api/client';
import type { StatsAggregate, ClickByPeriod, ClickByCountry, ClickByBrowser } from '../api/types';

const HTTP_NOT_FOUND = 404;
const HTTP_FORBIDDEN = 403;

function mapStatsError(err: unknown): string {
  if (err instanceof ApiError && err.status === HTTP_NOT_FOUND) return 'errors:noSuchLink';
  if (err instanceof ApiError && err.status === HTTP_FORBIDDEN) return 'errors:notLinkOwner';
  return 'errors:generic';
}

async function loadStats(slug: string): Promise<[StatsAggregate | null, string | null]> {
  try {
    const data = await apiFetch('/api/stats/{slug}', 'get', { pathParams: { slug } });
    return [data, null];
  } catch (err) {
    return [null, mapStatsError(err)];
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

interface NameClicksHeadProps {
  nameLabel: string;
  clicksLabel: string;
}
function NameClicksHead({ nameLabel, clicksLabel }: NameClicksHeadProps) {
  return (
    <TableHead>
      <TableRow>
        <TableCell>{nameLabel}</TableCell>
        <TableCell align="right">{clicksLabel}</TableCell>
      </TableRow>
    </TableHead>
  );
}

interface DayTableProps {
  rows: ClickByPeriod[];
}
function DayTable({ rows }: DayTableProps) {
  const { t } = useTranslation('stats');
  return (
    <Stack spacing={1} data-testid="stats-days-section">
      <Typography variant="h6">{t('byDay')}</Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <NameClicksHead nameLabel={t('date')} clicksLabel={t('clicks')} />
          <TableBody>
            {rows.map((r) => (
              <StatRow key={r.period} name={r.period} clicks={r.clicks} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

interface CountryTableProps {
  rows: ClickByCountry[];
  title: string;
}
function CountryTable({ rows, title }: CountryTableProps) {
  const { t } = useTranslation('stats');
  return (
    <Stack spacing={1} data-testid="stats-countries-section">
      <Typography variant="h6">{title}</Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <NameClicksHead nameLabel={t('name')} clicksLabel={t('clicks')} />
          <TableBody>
            {rows.map((r) => (
              <StatRow key={r.country} name={r.country} clicks={r.clicks} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

interface BrowserTableProps {
  rows: ClickByBrowser[];
  title: string;
}
function BrowserTable({ rows, title }: BrowserTableProps) {
  const { t } = useTranslation('stats');
  return (
    <Stack spacing={1} data-testid="stats-browsers-section">
      <Typography variant="h6">{title}</Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <NameClicksHead nameLabel={t('name')} clicksLabel={t('clicks')} />
          <TableBody>
            {rows.map((r) => (
              <StatRow key={r.browser} name={r.browser} clicks={r.clicks} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

interface StatsViewProps {
  slug: string;
  stats: StatsAggregate;
}
function StatsView({ slug, stats }: StatsViewProps) {
  const { t } = useTranslation('stats');
  return (
    <Stack spacing={3} data-testid="stats-view">
      <Typography variant="h4" data-testid="stats-slug">
        {slug}
      </Typography>
      <Typography data-testid="stats-total">
        {t('totalClicks', { count: stats.totalClicks })}
      </Typography>
      <DayTable rows={stats.byDay} />
      <CountryTable title={t('topCountries')} rows={stats.byCountry} />
      <BrowserTable title={t('topBrowsers')} rows={stats.byBrowser} />
    </Stack>
  );
}

export default function StatsPage() {
  const { t } = useTranslation('stats');
  const { slug = '' } = useParams<{ slug: string }>();
  const [stats, setStats] = useState<StatsAggregate | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadStats(slug).then(([s, key]) => {
      setStats(s);
      setErrorKey(key);
      setLoading(false);
    });
  }, [slug]);

  if (loading) return <CircularProgress data-testid="stats-loading" />;
  if (errorKey)
    return (
      <Alert severity="error" data-testid="stats-error">
        {t(errorKey)}
      </Alert>
    );
  if (!stats) return <Alert severity="warning">{t('noData')}</Alert>;
  return <StatsView slug={slug} stats={stats} />;
}
