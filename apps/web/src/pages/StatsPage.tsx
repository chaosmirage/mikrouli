import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
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
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import { BarChart } from '@mui/x-charts/BarChart';
import { ApiError, apiFetch } from '../api/client';
import type { StatsAggregate, ClickByPeriod, ClickByCountry, ClickByBrowser } from '../api/types';

const HTTP_NOT_FOUND = 404;
const HTTP_FORBIDDEN = 403;
const CHART_HEIGHT = 240;
const HORIZONTAL_CHART_HEIGHT_PER_ROW = 32;
const HORIZONTAL_CHART_MIN_HEIGHT = 160;
const UNKNOWN_LABEL_FALLBACK = '—';

// Module-level style constants (static, evaluated once)
const CARD_SECTION_TITLE_SX = { mb: 2, color: 'grey.700' } as const;
const CARD_SECTION_SX = { p: 3 } as const;
const CHART_BOX_SX = { width: '100%', height: CHART_HEIGHT } as const;
const STATS_SUBTITLE_SX = { color: 'text.secondary' } as const;
const TOTAL_OVERLINE_SX = { color: 'text.secondary', letterSpacing: '0.06em' } as const;
const TOTAL_NUMBER_SX = { fontVariantNumeric: 'tabular-nums', color: 'text.primary' } as const;
const STATS_BODY2_SX = { color: 'text.secondary' } as const;

function mapStatsError(err: unknown): string {
  if (err instanceof ApiError && err.status === HTTP_NOT_FOUND) return 'errors:noSuchLink';
  if (err instanceof ApiError && err.status === HTTP_FORBIDDEN) return 'errors:notLinkOwner';
  return 'errors:generic';
}

async function loadStats(slug: string): Promise<StatsAggregate> {
  return apiFetch('/api/stats/{slug}', 'get', { pathParams: { slug } });
}

function horizontalChartHeight(rowCount: number): number {
  return Math.max(HORIZONTAL_CHART_MIN_HEIGHT, rowCount * HORIZONTAL_CHART_HEIGHT_PER_ROW);
}

function fallbackLabel(name: string | null | undefined): string {
  if (!name) return UNKNOWN_LABEL_FALLBACK;
  return name;
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

interface CardSectionProps {
  title: string;
  testId: string;
  children: React.ReactNode;
}
function CardSection({ title, testId, children }: CardSectionProps) {
  return (
    <Paper variant="outlined" data-testid={testId} sx={CARD_SECTION_SX}>
      <Typography variant="h6" sx={CARD_SECTION_TITLE_SX}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

interface ClicksOverTimeChartProps {
  rows: ClickByPeriod[];
  title: string;
  emptyLabel: string;
  clicksLabel: string;
  color: string;
}
function ClicksOverTimeChart({ rows, title, emptyLabel, clicksLabel, color }: ClicksOverTimeChartProps) {
  if (rows.length === 0) {
    return (
      <CardSection title={title} testId="stats-clicks-chart">
        <Typography color="text.secondary">{emptyLabel}</Typography>
      </CardSection>
    );
  }
  const labels = rows.map((r) => r.period);
  const clicks = rows.map((r) => r.clicks);
  return (
    <CardSection title={title} testId="stats-clicks-chart">
      <Box sx={CHART_BOX_SX}>
        <BarChart
          xAxis={[{ scaleType: 'band', data: labels }]}
          series={[{ data: clicks, label: clicksLabel, color }]}
          height={CHART_HEIGHT}
          margin={{ top: 16, right: 16, bottom: 24, left: 40 }}
        />
      </Box>
    </CardSection>
  );
}

interface HorizontalChartProps {
  rows: Array<{ name: string; clicks: number }>;
  title: string;
  emptyLabel: string;
  clicksLabel: string;
  color: string;
  testId: string;
}
function HorizontalChart({ rows, title, emptyLabel, clicksLabel, color, testId }: HorizontalChartProps) {
  const height = horizontalChartHeight(rows.length);
  const chartBoxSx = useMemo(() => ({ width: '100%', height }), [height]);
  if (rows.length === 0) {
    return (
      <CardSection title={title} testId={testId}>
        <Typography color="text.secondary">{emptyLabel}</Typography>
      </CardSection>
    );
  }
  const labels = rows.map((r) => r.name);
  const clicks = rows.map((r) => r.clicks);
  return (
    <CardSection title={title} testId={testId}>
      <Box sx={chartBoxSx}>
        <BarChart
          layout="horizontal"
          yAxis={[{ scaleType: 'band', data: labels }]}
          series={[{ data: clicks, label: clicksLabel, color }]}
          height={height}
          margin={{ top: 16, right: 16, bottom: 24, left: 96 }}
        />
      </Box>
    </CardSection>
  );
}

interface DayTableProps {
  rows: ClickByPeriod[];
}
function DayTable({ rows }: DayTableProps) {
  const { t } = useTranslation('stats');
  return (
    <Stack spacing={1} data-testid="stats-days-section">
      <Typography variant="subtitle2" sx={STATS_SUBTITLE_SX}>
        {t('byDay')}
      </Typography>
      <TableContainer component={Paper} variant="outlined">
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
      <Typography variant="subtitle2" sx={STATS_SUBTITLE_SX}>
        {title}
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <NameClicksHead nameLabel={t('name')} clicksLabel={t('clicks')} />
          <TableBody>
            {rows.map((r) => (
              <StatRow key={r.country} name={fallbackLabel(r.country)} clicks={r.clicks} />
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
      <Typography variant="subtitle2" sx={STATS_SUBTITLE_SX}>
        {title}
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <NameClicksHead nameLabel={t('name')} clicksLabel={t('clicks')} />
          <TableBody>
            {rows.map((r) => (
              <StatRow key={r.browser} name={fallbackLabel(r.browser)} clicks={r.clicks} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

interface TotalCardProps {
  total: number;
  label: string;
}
function TotalCard({ total, label }: TotalCardProps) {
  return (
    <Paper variant="outlined" sx={CARD_SECTION_SX} data-testid="stats-total-card">
      <Typography variant="overline" sx={TOTAL_OVERLINE_SX}>
        {label}
      </Typography>
      <Typography variant="h3" data-testid="stats-total" sx={TOTAL_NUMBER_SX}>
        {total.toLocaleString()}
      </Typography>
    </Paper>
  );
}

interface StatsViewProps {
  slug: string;
  stats: StatsAggregate;
}
function StatsView({ slug, stats }: StatsViewProps) {
  const { t } = useTranslation('stats');
  const theme = useTheme();
  const primaryColor = theme.palette.primary.main;
  const secondaryColor = theme.palette.secondary.main;
  const warningColor = theme.palette.warning.main;
  const countryRows = stats.byCountry.map((r) => ({ name: fallbackLabel(r.country), clicks: r.clicks }));
  const browserRows = stats.byBrowser.map((r) => ({ name: fallbackLabel(r.browser), clicks: r.clicks }));
  return (
    <Stack spacing={3} data-testid="stats-view">
      <Stack spacing={0.5}>
        <Typography variant="h4" data-testid="stats-slug">
          {slug}
        </Typography>
        <Typography variant="body2" sx={STATS_BODY2_SX}>
          {t('title', { slug })}
        </Typography>
      </Stack>
      <TotalCard total={stats.totalClicks} label={t('totalClicks', { count: stats.totalClicks })} />
      <ClicksOverTimeChart
        rows={stats.byDay}
        title={t('byDay')}
        emptyLabel={t('noData')}
        clicksLabel={t('clicks')}
        color={primaryColor}
      />
      <HorizontalChart
        rows={countryRows}
        title={t('topCountries')}
        emptyLabel={t('noData')}
        clicksLabel={t('clicks')}
        color={secondaryColor}
        testId="stats-countries-chart"
      />
      <HorizontalChart
        rows={browserRows}
        title={t('topBrowsers')}
        emptyLabel={t('noData')}
        clicksLabel={t('clicks')}
        color={warningColor}
        testId="stats-browsers-chart"
      />
      <DayTable rows={stats.byDay} />
      <CountryTable title={t('topCountries')} rows={stats.byCountry} />
      <BrowserTable title={t('topBrowsers')} rows={stats.byBrowser} />
    </Stack>
  );
}

export default function StatsPage() {
  const { t } = useTranslation('stats');
  const { slug = '' } = useParams<{ slug: string }>();

  const { data: stats, error, isLoading } = useQuery({
    queryKey: ['stats', slug],
    queryFn: () => loadStats(slug),
  });

  if (isLoading) return <CircularProgress data-testid="stats-loading" />;
  if (error) {
    const errorKey = mapStatsError(error);
    return (
      <Alert severity="error" data-testid="stats-error">
        {t(errorKey)}
      </Alert>
    );
  }
  if (!stats) return <Alert severity="warning">{t('noData')}</Alert>;
  return <StatsView slug={slug} stats={stats} />;
}
