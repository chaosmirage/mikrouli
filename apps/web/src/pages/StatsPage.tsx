import { useMemo } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useTheme, Theme } from '@mui/material/styles';
import { BarChart } from '@mui/x-charts/BarChart';
import { ApiError, apiFetch } from '../api/client';
import { formatDate, formatNumber } from '../i18n/format';
import type { StatsAggregate, ClickByPeriod, PublicLink } from '../api/types';

const HTTP_NOT_FOUND = 404;
const HTTP_FORBIDDEN = 403;
// The course reads as one calm band of ink: tall enough to carry its trend,
// never a billboard beside the certain total.
const CHART_HEIGHT = 120;
// The proportion meter's full scale: the honest share of the certain total,
// so a breakdown's bar reads against the same whole in both columns.
const METER_SCALE = 300;

// Zone separation between the record's readings: magnitude, trend, comparison.
const ZONE_SPACING = 6;

const CHART_MARGIN = { top: 8, right: 8, bottom: 24, left: 8 } as const;

// Module-level style constants (static, evaluated once). Numerals align in
// tabular figures wherever standings are compared.
const STATS_VIEW_SX = { pt: 2 } as const;
// The record's one display numeral: the certain total at the display weight,
// the largest reading on the surface, zero at the same scale.
const TOTAL_NUMBER_SX = {
  fontSize: '4.5rem',
  color: 'text.primary',
  fontVariantNumeric: 'tabular-nums',
} as const;
const TOTAL_QUALIFICATION_SX = { color: 'text.disabled', fontSize: '0.75rem' } as const;
const CHART_BOX_SX = {
  width: '100%',
  height: CHART_HEIGHT,
  // Inherited by the chart's SVG text so axis numerals stand in tabular figures.
  fontVariantNumeric: 'tabular-nums',
} as const;
const EMPTY_READING_SX = { color: 'text.secondary' } as const;
// The record's short address reads in the theme's fixed-width technical
// register: a character-exact string must be read character-exactly, because
// a mistyped address fails late. Size stays the identity's own step.
// (The optional chain keeps the address legible under a theme that predates
// the register.)
const SHORT_ADDRESS_SX = {
  fontFamily: (theme: Theme) => theme.typography.technical?.fontFamily,
  fontSize: '1.25rem',
  color: 'text.primary',
} as const;

// The record's identity names where the short address resolves: the
// destination stands as meta under the address, folding anywhere a spaceless
// URL needs to rather than overflowing the column.
const DESTINATION_SX = {
  color: 'text.disabled',
  fontSize: '0.75rem',
  overflowWrap: 'anywhere',
} as const;

// The breakdowns stand as two named columns: each column's head names the
// comparison it carries, and the columns read side by side wherever the
// measure allows.
const BREAKDOWNS_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
  columnGap: { md: 15 },
  rowGap: 4,
} as const;
const BREAKDOWN_HEAD_SX = { color: 'text.secondary' } as const;
const BREAKDOWN_NAME_SX = { color: 'text.primary' } as const;
const BREAKDOWN_SHARE_SX = {
  color: 'text.disabled',
  fontSize: '0.75rem',
  fontVariantNumeric: 'tabular-nums',
} as const;
// The share's own meter: a thin proportion bar in the neutral track ink —
// never an accent hue on a reading.
const METER_SX = {
  height: 6,
  borderRadius: 3,
  backgroundColor: 'secondary.light',
  maxWidth: METER_SCALE,
  mt: 0.5,
} as const;

// The chart reads its typography from the theme so the axis standings follow
// the same register and ink as the page's meta text.
function chartAxisSlotProps(theme: Theme) {
  return {
    axisTickLabel: {
      fontSize: '0.75rem',
      fontFamily: theme.typography.fontFamily,
      fill: theme.palette.text.secondary,
    },
  };
}

function mapStatsError(err: unknown): string {
  if (err instanceof ApiError && err.status === HTTP_NOT_FOUND) return 'errors:noSuchLink';
  if (err instanceof ApiError && err.status === HTTP_FORBIDDEN) return 'errors:notLinkOwner';
  return 'errors:generic';
}

async function loadStats(slug: string): Promise<StatsAggregate> {
  return apiFetch('/api/stats/{slug}', 'get', { pathParams: { slug } });
}

// The record's identity names the destination, which the stats resource does
// not carry: it is read from the owner's set (the dashboard's own `links`
// cache entry, so a dashboard -> record journey serves it with no extra call).
// The record stands complete without it when the set is not in reach.
async function loadOwnedLinks(): Promise<PublicLink[]> {
  const response = await apiFetch('/api/urls', 'get');
  return response.data ?? [];
}

function slugOf(shortUrl: string): string {
  const parts = shortUrl.split('/');
  return parts[parts.length - 1] ?? shortUrl;
}

// The record's own host: the short address's origin as it resolves wherever
// the client stands, so the address reads as the host the owner shares.
function shortHost(): string {
  return typeof window === 'undefined' ? '' : window.location.host;
}

/** Rank the arriving breakdown by recorded clicks so rows read as standings;
 * a name the arriving data does not say stands as exactly "Unknown". */
function rankStandings(
  rows: Array<{ name: string; clicks: number }>,
  unknownLabel: string,
): Array<{ name: string; clicks: number }> {
  return rows
    .map((row) => ({ name: row.name.trim() === '' ? unknownLabel : row.name, clicks: row.clicks }))
    .sort((a, b) => b.clicks - a.clicks);
}

/** The row's honest share of the certain total, as the whole percent the
 * record states it at. */
function shareOfTotal(clicks: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((clicks / total) * 100);
}

interface TotalReadingProps {
  total: number;
  qualification: string;
}
function TotalReading({ total, qualification }: TotalReadingProps) {
  return (
    <Stack spacing={0.5} data-testid="stats-total-zone">
      {/* One numeral, honest about what it counts; zero use reads here too. */}
      <Typography variant="display" data-testid="stats-total" sx={TOTAL_NUMBER_SX}>
        {formatNumber(total)}
      </Typography>
      <Typography sx={TOTAL_QUALIFICATION_SX}>{qualification}</Typography>
    </Stack>
  );
}

interface CourseOverTimeProps {
  rows: ClickByPeriod[];
  emptyLabel: string;
  color: string;
  axisSlotProps: ReturnType<typeof chartAxisSlotProps>;
}
// The course across time: one calm band of ink-secondary bars on a recessive
// axis — no accent hue, no grid, no y readings; the trend carries itself.
function CourseOverTime({ rows, emptyLabel, color, axisSlotProps }: CourseOverTimeProps) {
  const labels = useMemo(() => rows.map((r) => formatDate(r.period)), [rows]);
  const clicks = useMemo(() => rows.map((r) => r.clicks), [rows]);
  // The axis names only the course's two ends; the days between are carried
  // by the band's own shape.
  const tickInterval = useMemo(
    () => (labels.length > 0 ? [labels[0], labels[labels.length - 1]] : []),
    [labels],
  );
  if (rows.length === 0) {
    return (
      <Box data-testid="stats-clicks-chart">
        <Typography variant="body2" sx={EMPTY_READING_SX}>
          {emptyLabel}
        </Typography>
      </Box>
    );
  }
  return (
    <Box sx={CHART_BOX_SX} data-testid="stats-clicks-chart">
      <BarChart
        xAxis={[{ scaleType: 'band', data: labels, tickInterval }]}
        series={[{ data: clicks, color }]}
        leftAxis={null}
        height={CHART_HEIGHT}
        margin={CHART_MARGIN}
        slotProps={axisSlotProps}
      />
    </Box>
  );
}

interface RankedBreakdownProps {
  title: string;
  testId: string;
  rows: Array<{ name: string; clicks: number }>;
  total: number;
  emptyLabel: string;
}
// One comparable breakdown: a head naming the comparison, then ranked rows —
// each row its name, its honest share of the certain total, and a thin
// proportion bar in the neutral track ink.
function RankedBreakdown({ title, testId, rows, total, emptyLabel }: RankedBreakdownProps) {
  return (
    <Stack spacing={2} data-testid={testId}>
      <Typography variant="overline" sx={BREAKDOWN_HEAD_SX}>
        {title}
      </Typography>
      {rows.length === 0 ? (
        <Typography variant="body2" sx={EMPTY_READING_SX}>
          {emptyLabel}
        </Typography>
      ) : (
        rows.map((row) => (
          <Box key={row.name} data-testid={`${testId}-row`}>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline">
              <Typography variant="body2" sx={BREAKDOWN_NAME_SX}>
                {row.name}
              </Typography>
              <Typography sx={BREAKDOWN_SHARE_SX}>
                {formatNumber(shareOfTotal(row.clicks, total))}%
              </Typography>
            </Stack>
            <Box sx={{ ...METER_SX, width: `${shareOfTotal(row.clicks, total)}%` }} aria-hidden />
          </Box>
        ))
      )}
    </Stack>
  );
}

interface StatsViewProps {
  slug: string;
  stats: StatsAggregate;
  destination: string | null;
}
function StatsView({ slug, stats, destination }: StatsViewProps) {
  const { t } = useTranslation('stats');
  const theme = useTheme();
  // The record states; it does not ask. Series and standings read as ink, not
  // as accent hues, so no reading carries a promotional color.
  const inkColor = theme.palette.text.secondary;
  const axisSlotProps = useMemo(() => chartAxisSlotProps(theme), [theme]);
  const unknownLabel = t('unknown');
  const countryRows = useMemo(
    () =>
      rankStandings(
        stats.byCountry.map(({ country, clicks }) => ({ name: country, clicks })),
        unknownLabel,
      ),
    [stats.byCountry, unknownLabel],
  );
  const browserRows = useMemo(
    () =>
      rankStandings(
        stats.byBrowser.map(({ browser, clicks }) => ({ name: browser, clicks })),
        unknownLabel,
      ),
    [stats.byBrowser, unknownLabel],
  );
  return (
    <Stack spacing={ZONE_SPACING} sx={STATS_VIEW_SX} data-testid="stats-view">
      <Stack spacing={0.5}>
        <Button
          component={RouterLink}
          to="/dashboard"
          size="small"
          startIcon={<ArrowBackIcon />}
          sx={{ alignSelf: 'flex-start', color: 'ink.muted' }}
          data-testid="stats-leave"
        >
          {t('backToDashboard')}
        </Button>
        {/* The record's technical address: host and slug in the fixed-width
            register, with the slug's own harness address carried by the slug
            span alone so it reads character-exactly wherever it is taken. */}
        <Typography variant="h4">
          {shortHost()}/
          <Box component="span" sx={SHORT_ADDRESS_SX} data-testid="stats-slug">
            {slug}
          </Box>
        </Typography>
        {destination !== null ? (
          <Typography sx={DESTINATION_SX} data-testid="stats-destination">
            → {destination}
          </Typography>
        ) : null}
      </Stack>
      <TotalReading total={stats.totalClicks} qualification={t('recordedRedirects')} />
      <CourseOverTime
        rows={stats.byDay}
        emptyLabel={t('noData')}
        color={inkColor}
        axisSlotProps={axisSlotProps}
      />
      <Box sx={BREAKDOWNS_SX}>
        <RankedBreakdown
          title={t('topCountries')}
          testId="stats-countries-rows"
          rows={countryRows}
          total={stats.totalClicks}
          emptyLabel={t('noData')}
        />
        <RankedBreakdown
          title={t('topBrowsers')}
          testId="stats-browsers-rows"
          rows={browserRows}
          total={stats.totalClicks}
          emptyLabel={t('noData')}
        />
      </Box>
    </Stack>
  );
}

export default function StatsPage() {
  const { t } = useTranslation('stats');
  const { slug = '' } = useParams<{ slug: string }>();

  const {
    data: stats,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['stats', slug],
    queryFn: () => loadStats(slug),
  });
  // The destination is read from the owner's set; a record whose set is out of
  // reach still stands complete, so this query never gates the page.
  const { data: ownedLinks = [] } = useQuery({
    queryKey: ['links'],
    queryFn: loadOwnedLinks,
  });
  const destination = useMemo(
    () => ownedLinks.find((link) => slugOf(link.shortUrl) === slug)?.originalUrl ?? null,
    [ownedLinks, slug],
  );

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
  return <StatsView slug={slug} stats={stats} destination={destination} />;
}
