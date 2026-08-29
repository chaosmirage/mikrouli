import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { apiFetch } from '../api/client';
import type { UsageSummary } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import StandingsRow from '../components/StandingsRow';
import StatementBand from '../components/StatementBand';
import { formatDate, formatNumber } from '../i18n/format';

const SUPPORT_EMAIL = 'support@mikrou.li';
const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

// Zone separation between the statement and the standing review.
const ZONE_SPACING = 5;

const PAGE_SX = { maxWidth: 600 } as const;
const CARD_SX = { minWidth: 260, flex: 1 } as const;
const PROGRESS_SX = { height: 8, borderRadius: 1 } as const;

function usedPercent(created: number, limit: number): number {
  if (limit <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((created / limit) * 100)));
}

async function loadUsage(): Promise<UsageSummary> {
  return apiFetch('/api/usage', 'get');
}

function yearsFromMs(ms: number): number {
  return Math.round(ms / MS_PER_YEAR);
}

/** The surface's own naming and the one line naming the capability. */
function CapabilityStatement() {
  const { t } = useTranslation('usage');
  return (
    <Stack spacing={1}>
      <Typography variant="h4" component="h1">
        {t('title')}
      </Typography>
      <Typography color="text.secondary">{t('intro')}</Typography>
    </Stack>
  );
}

interface StandingCardProps {
  title: string;
  created: number;
  limit: number;
  remaining: number;
  exhaustedStatement: string;
  createdTestId: string;
  remainingTestId: string;
  cardTestId: string;
}
/**
 * One standing against its limit: the fill proportion first, then the created,
 * limit, and remaining figures as labeled standings. An exhausted allowance is
 * stated as resolved matter with the standing it belongs to.
 */
function StandingCard({
  title,
  created,
  limit,
  remaining,
  exhaustedStatement,
  createdTestId,
  remainingTestId,
  cardTestId,
}: StandingCardProps) {
  const { t } = useTranslation('usage');
  const percent = usedPercent(created, limit);
  const exhausted = remaining <= 0;
  return (
    <Card variant="outlined" sx={CARD_SX} data-testid={cardTestId}>
      <CardContent>
        <Stack spacing={1.5}>
          <Typography variant="h6">{title}</Typography>
          <LinearProgress
            variant="determinate"
            value={percent}
            color={exhausted ? 'error' : 'primary'}
            data-testid={`${cardTestId}-progress`}
            aria-label={t('usageProgress', { used: created, total: limit })}
            sx={PROGRESS_SX}
          />
          {exhausted && (
            <Alert severity="warning" data-testid={`${cardTestId}-exhausted`}>
              {exhaustedStatement}
            </Alert>
          )}
          <StandingsRow
            standings={[
              { label: t('created'), value: formatNumber(created), testId: createdTestId },
              { label: t('limit'), value: formatNumber(limit), testId: `${cardTestId}-limit` },
              {
                label: t('remaining'),
                value: formatNumber(remaining),
                testId: remainingTestId,
              },
            ]}
          />
        </Stack>
      </CardContent>
    </Card>
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
    <Stack spacing={ZONE_SPACING} sx={PAGE_SX} data-testid="usage-page">
      <CapabilityStatement />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <StandingCard
          title={t('linksQuota')}
          created={summary.linksCreated}
          limit={summary.linkLimit}
          remaining={summary.linksRemaining}
          exhaustedStatement={t('overLimitLinks')}
          createdTestId="links-created"
          remainingTestId="links-remaining"
          cardTestId="links-quota-card"
        />
        <StandingCard
          title={t('keysQuota')}
          created={summary.keysCreated}
          limit={summary.keyLimit}
          remaining={summary.keysRemaining}
          exhaustedStatement={t('overLimitKeys')}
          createdTestId="keys-created"
          remainingTestId="keys-remaining"
          cardTestId="keys-quota-card"
        />
      </Stack>
      <StandingsRow
        standings={[
          {
            label: t('resetDate'),
            value: formatDate(summary.resetDate),
            testId: 'reset-date',
          },
          {
            label: t('retention'),
            value: t('retentionYears', { count: yearsFromMs(summary.retentionMs) }),
            testId: 'retention-info',
          },
        ]}
      />
      <Button
        component="a"
        href={mailtoHref}
        variant="outlined"
        data-testid="request-more-btn"
        sx={{ alignSelf: 'flex-start' }}
      >
        {t('requestMore')}
      </Button>
    </Stack>
  );
}

export default function UsagePage() {
  const { user } = useAuth();
  const { data: summary, error, isLoading } = useQuery({
    queryKey: ['usage'],
    queryFn: loadUsage,
  });

  if (isLoading) return <CircularProgress data-testid="usage-loading" />;
  if (error) return <StatementBand state={{ kind: 'failure', cause: error }} />;
  if (!summary) return null;
  return <UsageView summary={summary} email={user?.email ?? ''} />;
}
