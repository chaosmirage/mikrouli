import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { apiFetch } from '../api/client';
import type { UsageSummary } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import StatementBand from '../components/StatementBand';
import { formatDate, formatNumber } from '../i18n/format';

const SUPPORT_EMAIL = 'support@mikrou.li';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Zone separation between the statement and the standings.
const ZONE_SPACING = 5;

// The standings read in the measure the account's limits name — the quota
// meters stand one under the other, each as wide as its own reading.
const STANDINGS_SX = { maxWidth: 520 } as const;

// The fill proportion: a thin meter on the neutral track, the fill in the
// secondary ink — a reading, never a promotional hue.
const PROGRESS_SX = {
  height: 8,
  borderRadius: 1,
  backgroundColor: 'secondary.light',
  '& .MuiLinearProgress-bar': { borderRadius: 1, backgroundColor: 'ink.secondary' },
} as const;

const QUOTA_NAME_SX = { color: 'text.primary' } as const;
const QUOTA_VALUE_SX = {
  color: 'text.secondary',
  fontSize: '0.75rem',
  fontVariantNumeric: 'tabular-nums',
} as const;

// The reset and retention meta: one muted line naming what the standings
// stand against. The line owns the standings' own measure, so the request
// reach stands past it — beside the meta, under the standings' right edge.
const META_SX = {
  color: 'ink.muted',
  fontSize: '0.75rem',
  minWidth: { sm: STANDINGS_SX.maxWidth },
} as const;

function usedPercent(created: number, limit: number): number {
  if (limit <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((created / limit) * 100)));
}

async function loadUsage(): Promise<UsageSummary> {
  return apiFetch('/api/usage', 'get');
}

function daysFromMs(ms: number): number {
  return Math.max(0, Math.round(ms / MS_PER_DAY));
}

/** The surface's own naming and the one line naming the capability. */
function CapabilityStatement() {
  const { t } = useTranslation('usage');
  return (
    <Stack spacing={1}>
      <Typography variant="title" component="h1">
        {t('title')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t('intro')}
      </Typography>
    </Stack>
  );
}

interface StandingZoneProps {
  title: string;
  created: number;
  limit: number;
  remaining: number;
  exhaustedStatement: string;
  createdTestId: string;
  cardTestId: string;
}
/**
 * One standing against its limit: the standing's name, its used-and-limit
 * reading, and the fill proportion as a thin meter. An exhausted allowance is
 * stated as resolved matter with the standing it belongs to — never a hidden
 * gate.
 */
function StandingZone({
  title,
  created,
  limit,
  remaining,
  exhaustedStatement,
  createdTestId,
  cardTestId,
}: StandingZoneProps) {
  const { t } = useTranslation('usage');
  const percent = usedPercent(created, limit);
  const exhausted = remaining <= 0;
  return (
    <Stack spacing={1} sx={STANDINGS_SX} data-testid={cardTestId}>
      <Stack spacing={0.5}>
        <Typography variant="body1" sx={QUOTA_NAME_SX}>
          {title}
        </Typography>
        <Typography sx={QUOTA_VALUE_SX}>
          <span data-testid={createdTestId}>{formatNumber(created)}</span>
          {' / '}
          <span data-testid={`${cardTestId}-limit`}>{formatNumber(limit)}</span>
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={percent}
        data-testid={`${cardTestId}-progress`}
        aria-label={t('usageProgress', { used: created, total: limit })}
        sx={PROGRESS_SX}
      />
      {exhausted && (
        <Alert severity="warning" data-testid={`${cardTestId}-exhausted`}>
          {exhaustedStatement}
        </Alert>
      )}
    </Stack>
  );
}

interface UsageViewProps {
  summary: UsageSummary;
  email: string;
}
function UsageView({ summary, email }: UsageViewProps) {
  const { t } = useTranslation('usage');
  const subject = encodeURIComponent(t('requestSubject'));
  const body = encodeURIComponent(t('requestBody', { email }));
  const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

  return (
    <Stack spacing={ZONE_SPACING} data-testid="usage-page">
      <CapabilityStatement />
      <Stack spacing={4}>
        <StandingZone
          title={t('linksQuota')}
          created={summary.linksCreated}
          limit={summary.linkLimit}
          remaining={summary.linksRemaining}
          exhaustedStatement={t('overLimitLinks')}
          createdTestId="links-created"
          cardTestId="links-quota-card"
        />
        <StandingZone
          title={t('keysQuota')}
          created={summary.keysCreated}
          limit={summary.keyLimit}
          remaining={summary.keysRemaining}
          exhaustedStatement={t('overLimitKeys')}
          createdTestId="keys-created"
          cardTestId="keys-quota-card"
        />
      </Stack>
      {/* The standings' meta and the request reach travel on one row: what
          the standings stand against, and the one act that changes them. */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ sm: 'center' }}>
        <Typography sx={META_SX}>
          <span data-testid="reset-date">
            {t('resets', { date: formatDate(summary.resetDate) })}
          </span>
          {' · '}
          <span data-testid="retention-info">
            {t('eventsRetained', {
              count: daysFromMs(summary.retentionMs),
            })}
          </span>
        </Typography>
        <Button
          component="a"
          href={mailtoHref}
          variant="outlined"
          data-testid="request-more-btn"
          sx={{ alignSelf: 'flex-start', whiteSpace: 'nowrap' }}
        >
          {t('requestMore')}
        </Button>
      </Stack>
    </Stack>
  );
}

export default function UsagePage() {
  const { user } = useAuth();
  const {
    data: summary,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['usage'],
    queryFn: loadUsage,
  });

  if (isLoading) return <CircularProgress data-testid="usage-loading" />;
  if (error) return <StatementBand state={{ kind: 'failure', cause: error }} />;
  if (!summary) return null;
  return <UsageView summary={summary} email={user?.email ?? ''} />;
}
