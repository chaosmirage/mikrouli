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
import StandingsRow from '../components/StandingsRow';
import { ApiError, apiFetch } from '../api/client';
import { formatDate, formatNumber } from '../i18n/format';
import type { StatsAggregate, ClickByPeriod } from '../api/types';

const HTTP_NOT_FOUND = 404;
const HTTP_FORBIDDEN = 403;
const CHART_HEIGHT = 240;

// Zone separation between the record's readings: magnitude, trend, comparison.
const ZONE_SPACING = 5;

const CHART_MARGIN = { top: 16, right: 16, bottom: 24, left: 40 } as const;

// Module-level style constants (static, evaluated once). Numerals align in
// tabular figures wherever standings are compared.
const STATS_VIEW_SX = { pt: 2 } as const;
const STATS_BODY2_SX = { color: 'text.secondary' } as const;
const ZONE_TITLE_SX = { color: 'text.secondary' } as const;
const TOTAL_LABEL_SX = { color: 'text.secondary', letterSpacing: '0.06em' } as const;
const TOTAL_NUMBER_SX = { fontVariantNumeric: 'tabular-nums', color: 'text.primary' } as const;
const TOTAL_QUALIFICATION_SX = { color: 'text.disabled' } as const;
const CHART_BOX_SX = {
  width: '100%',
  height: CHART_HEIGHT,
  // Inherited by the chart's SVG text so axis numerals stand in tabular figures.
  fontVariantNumeric: 'tabular-nums',
} as const;
const LIST_RESET_SX = { listStyle: 'none', m: 0, p: 0 } as const;
const LIST_ITEM_SX = { display: 'list-item' } as const;
const EMPTY_READING_SX = { color: 'text.secondary' } as const;
// The record's short address reads in the theme's fixed-width technical
// register: a character-exact string must be read character-exactly, because
// a mistyped address fails late. Size and ink stay the heading's own step.
// (The optional chain keeps the address legible under a theme that predates
// the register.)
const SHORT_ADDRESS_SX = {
  fontFamily: (theme: Theme) => theme.typography.technical?.fontFamily,
} as const;

// The chart reads its typography from the theme so the axis standings follow
// the same register and ink as the page's meta text.
function chartAxisSlotProps(theme: Theme) {
  return {
    axisTickLabel: {
      fontSize: theme.typography.caption.fontSize,
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

interface TotalReadingProps {
  total: number;
  label: string;
  qualification: string;
}
function TotalReading({ total, label, qualification }: TotalReadingProps) {
  return (
    <Stack spacing={0.5} data-testid="stats-total-zone">
      <Typography variant="overline" sx={TOTAL_LABEL_SX}>
        {label}
      </Typography>
      {/* One numeral, honest about what it counts; zero use reads here too. */}
      <Typography variant="h2" data-testid="stats-total" sx={TOTAL_NUMBER_SX}>
        {formatNumber(total)}
      </Typography>
      <Typography variant="caption" sx={TOTAL_QUALIFICATION_SX}>
        {qualification}
      </Typography>
    </Stack>
  );
}

interface CourseOverTimeProps {
  rows: ClickByPeriod[];
  title: string;
  emptyLabel: string;
  clicksLabel: string;
  color: string;
  axisSlotProps: ReturnType<typeof chartAxisSlotProps>;
}
function CourseOverTime({
  rows,
  title,
  emptyLabel,
  clicksLabel,
  color,
  axisSlotProps,
}: CourseOverTimeProps) {
  const labels = rows.map((r) => formatDate(r.period));
  const clicks = rows.map((r) => r.clicks);
  return (
    <Stack spacing={1} data-testid="stats-clicks-chart">
      <Typography variant="subtitle2" sx={ZONE_TITLE_SX}>
        {title}
      </Typography>
      {rows.length === 0 ? (
        <Typography variant="body2" sx={EMPTY_READING_SX}>
          {emptyLabel}
        </Typography>
      ) : (
        <Box sx={CHART_BOX_SX}>
          <BarChart
            xAxis={[{ scaleType: 'band', data: labels }]}
            series={[{ data: clicks, label: clicksLabel, color }]}
            height={CHART_HEIGHT}
            margin={CHART_MARGIN}
            slotProps={axisSlotProps}
          />
        </Box>
      )}
    </Stack>
  );
}

interface RankedStandingsProps {
  title: string;
  testId: string;
  rows: Array<{ name: string; clicks: number }>;
  emptyLabel: string;
}
function RankedStandings({ title, testId, rows, emptyLabel }: RankedStandingsProps) {
  return (
    <Stack spacing={1} data-testid={testId}>
      <Typography variant="subtitle2" sx={ZONE_TITLE_SX}>
        {title}
      </Typography>
      {rows.length === 0 ? (
        <Typography variant="body2" sx={EMPTY_READING_SX}>
          {emptyLabel}
        </Typography>
      ) : (
        <Stack component="ul" sx={LIST_RESET_SX}>
          {rows.map((row) => (
            <Box component="li" key={row.name} sx={LIST_ITEM_SX}>
              <StandingsRow standings={[{ label: row.name, value: formatNumber(row.clicks) }]} />
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

interface StatsViewProps {
  slug: string;
  stats: StatsAggregate;
}
function StatsView({ slug, stats }: StatsViewProps) {
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
          sx={{ alignSelf: 'flex-start' }}
          data-testid="stats-leave"
        >
          {t('backToDashboard')}
        </Button>
        <Typography variant="h4" data-testid="stats-slug" sx={SHORT_ADDRESS_SX}>
          {slug}
        </Typography>
        <Typography variant="body2" sx={STATS_BODY2_SX}>
          {t('title', { slug })}
        </Typography>
      </Stack>
      <TotalReading
        total={stats.totalClicks}
        label={t('totalClicks', { count: stats.totalClicks })}
        qualification={t('recordedRedirects')}
      />
      <CourseOverTime
        rows={stats.byDay}
        title={t('byDay')}
        emptyLabel={t('noData')}
        clicksLabel={t('clicks')}
        color={inkColor}
        axisSlotProps={axisSlotProps}
      />
      <RankedStandings
        title={t('topCountries')}
        testId="stats-countries-rows"
        rows={countryRows}
        emptyLabel={t('noData')}
      />
      <RankedStandings
        title={t('topBrowsers')}
        testId="stats-browsers-rows"
        rows={browserRows}
        emptyLabel={t('noData')}
      />
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
