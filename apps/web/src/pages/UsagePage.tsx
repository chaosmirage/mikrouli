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

const SUPPORT_EMAIL = 'support@mikrou.li';
const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

const CARD_SX = { minWidth: 260 } as const;
const LABEL_SX = { color: 'text.secondary', fontSize: '0.875rem' } as const;
const VALUE_SX = { fontVariantNumeric: 'tabular-nums', fontWeight: 700 } as const;
const STACK_SX = { maxWidth: 600 } as const;
const PROGRESS_SX = { height: 8, borderRadius: 1 } as const;

function usedPercent(created: number, limit: number): number {
  if (limit <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((created / limit) * 100)));
}

async function loadUsage(): Promise<UsageSummary> {
  return apiFetch('/api/usage', 'get');
}

function formatRetention(ms: number): string {
  const years = ms / MS_PER_YEAR;
  return `${Math.round(years)} years`;
}

function formatResetDate(isoString: string): string {
  return isoString.slice(0, 10);
}

interface QuotaRowProps {
  label: string;
  value: number;
  testId: string;
}
function QuotaRow({ label, value, testId }: QuotaRowProps) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography sx={LABEL_SX}>{label}</Typography>
      <Typography sx={VALUE_SX} data-testid={testId}>
        {value}
      </Typography>
    </Stack>
  );
}

interface QuotaCardProps {
  title: string;
  created: number;
  limit: number;
  remaining: number;
  createdTestId: string;
  remainingTestId: string;
  cardTestId: string;
}
function QuotaCard({
  title,
  created,
  limit,
  remaining,
  createdTestId,
  remainingTestId,
  cardTestId,
}: QuotaCardProps) {
  const { t } = useTranslation('usage');
  const percent = usedPercent(created, limit);
  const exhausted = remaining <= 0;
  return (
    <Card variant="outlined" data-testid={cardTestId} sx={CARD_SX}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Stack spacing={1}>
          <LinearProgress
            variant="determinate"
            value={percent}
            color={exhausted ? 'error' : 'primary'}
            data-testid={`${cardTestId}-progress`}
            aria-label={t('usageProgress', { used: created, total: limit })}
            sx={PROGRESS_SX}
          />
          <QuotaRow label={t('created')} value={created} testId={createdTestId} />
          <QuotaRow label={t('limit')} value={limit} testId={`${cardTestId}-limit`} />
          <QuotaRow label={t('remaining')} value={remaining} testId={remainingTestId} />
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
    <Stack spacing={3} data-testid="usage-page" sx={STACK_SX}>
      <Typography variant="h4">{t('title')}</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <QuotaCard
          title={t('linksQuota')}
          created={summary.linksCreated}
          limit={summary.linkLimit}
          remaining={summary.linksRemaining}
          createdTestId="links-created"
          remainingTestId="links-remaining"
          cardTestId="links-quota-card"
        />
        <QuotaCard
          title={t('keysQuota')}
          created={summary.keysCreated}
          limit={summary.keyLimit}
          remaining={summary.keysRemaining}
          createdTestId="keys-created"
          remainingTestId="keys-remaining"
          cardTestId="keys-quota-card"
        />
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography sx={LABEL_SX}>{t('resetDate')}:</Typography>
        <Typography data-testid="reset-date">{formatResetDate(summary.resetDate)}</Typography>
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography sx={LABEL_SX}>{t('retention')}:</Typography>
        <Typography data-testid="retention-info">{formatRetention(summary.retentionMs)}</Typography>
      </Stack>
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
  const { t } = useTranslation('usage');
  const { user } = useAuth();
  const { data: summary, error, isLoading } = useQuery({
    queryKey: ['usage'],
    queryFn: loadUsage,
  });

  if (isLoading) return <CircularProgress data-testid="usage-loading" />;
  if (error) {
    return (
      <Alert severity="error" data-testid="usage-error">
        {t('overLimitLinks')}
      </Alert>
    );
  }
  if (!summary) return null;
  return <UsageView summary={summary} email={user?.email ?? ''} />;
}
