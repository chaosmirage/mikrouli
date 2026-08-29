import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Link from '@mui/material/Link';
import DashboardIcon from '@mui/icons-material/Dashboard';
import KeyIcon from '@mui/icons-material/Key';
import LinkIcon from '@mui/icons-material/Link';
import ShortenCard from '../components/ShortenCard';
import { useAuth } from '../auth/AuthContext';
import { useGuestShortenEnabled } from '../hooks/useGuestShortenEnabled';
import { SPACE } from '../theme';

// The landing is the one full-viewport composition: it stands outside the
// contained width and bounds its own reading columns instead. Spacing below
// follows the five-step space ladder over the theme's base unit (inline = 1,
// element = 2, block = 3, zone = 5); the named tokens land with the theme
// factory, so these multipliers are the nearest existing values.

// The reading measure bounding the first sight's scan span comes from the
// theme factory's SPACE token, the one measure the whole app reads.

const PAGE_SX = {
  pt: { xs: 6, md: 10 },
  pb: { xs: 6, md: 8 },
  bgcolor: 'background.default',
} as const;

const STATEMENT_COLUMN_SX = {
  maxWidth: `${SPACE.measure}px`,
  mx: 'auto',
  width: '100%',
  px: 2,
  textAlign: 'center',
} as const;

const STATEMENT_TITLE_SX = {
  color: 'text.primary',
  fontWeight: 800,
  letterSpacing: '-0.025em',
  lineHeight: 1.1,
  fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4rem' },
} as const;

const STATEMENT_SUPPORT_SX = { color: 'text.secondary', lineHeight: 1.6 } as const;

const ACT_SECTION_SX = { mt: 3, px: 2 } as const;

const ACT_COLUMN_SX = { maxWidth: `${SPACE.measure}px`, mx: 'auto', width: '100%' } as const;

// The claims band stands in the next downward glance, a full zone below the
// act, so the act is never scanned past.
const CLAIMS_SECTION_SX = { mt: 5, px: 2 } as const;

const CLAIMS_LIST_SX = {
  maxWidth: `${SPACE.measure}px`,
  mx: 'auto',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
} as const;

// Comparable claims look comparable: every entry is the identical shape — one
// claim line, one comparate line — differing only in content.
const CLAIM_TITLE_SX = { color: 'text.secondary', fontWeight: 600 } as const;
const CLAIM_COMPARATE_SX = { color: 'text.secondary' } as const;
const CLAIM_REACH_SX = { color: 'text.primary', fontWeight: 600, fontSize: '0.875rem' } as const;

const NUDGE_SX = { mt: 2, p: { xs: 2, sm: 3 } } as const;
const NUDGE_TITLE_SX = { mb: 1, fontWeight: 600 } as const;
const NUDGE_ICON_SX = { minWidth: 36 } as const;
const NUDGE_CTA_SX = { mt: 2 } as const;

interface ClaimReach {
  labelKey: string;
  to: string;
}

interface ClaimEntry {
  id: string;
  titleKey: string;
  comparateKey: string;
  reach?: ClaimReach;
}

// The free-capability claims, each naming its compared analog so the visitor
// chooses by seeing, not researching. The agent entry carries its reach to the
// connect surface, where that differentiator lives.
const CLAIMS: readonly ClaimEntry[] = [
  {
    id: 'analytics',
    titleKey: 'claimAnalyticsTitle',
    comparateKey: 'claimAnalyticsComparate',
  },
  { id: 'qr', titleKey: 'claimQrTitle', comparateKey: 'claimQrComparate' },
  {
    id: 'agents',
    titleKey: 'claimAgentsTitle',
    comparateKey: 'claimAgentsComparate',
    reach: { labelKey: 'claimAgentsReach', to: '/connect' },
  },
  {
    id: 'languages',
    titleKey: 'claimLanguagesTitle',
    comparateKey: 'claimLanguagesComparate',
  },
];

function ClaimRow({ claim }: { claim: ClaimEntry }) {
  const { t } = useTranslation('landing');
  return (
    <ListItem disableGutters data-testid={`landing-claim-${claim.id}`}>
      <Stack spacing={0.5}>
        <Typography variant="body1" sx={CLAIM_TITLE_SX}>
          {t(claim.titleKey)}
        </Typography>
        <Typography variant="body2" sx={CLAIM_COMPARATE_SX}>
          {t(claim.comparateKey)}
        </Typography>
        {claim.reach && (
          <Link
            component={RouterLink}
            to={claim.reach.to}
            underline="always"
            data-testid={`landing-claim-${claim.id}-reach`}
            sx={CLAIM_REACH_SX}
          >
            {t(claim.reach.labelKey)}
          </Link>
        )}
      </Stack>
    </ListItem>
  );
}

// The first-sight statement: what the product is, in the strongest ink
// directly on the canvas — no card, no illustration, no gradient.
function FirstSightStatement() {
  const { t } = useTranslation('landing');
  return (
    <Box component="section" data-testid="landing-statement">
      <Stack spacing={2} sx={STATEMENT_COLUMN_SX}>
        <Typography variant="h2" component="h1" sx={STATEMENT_TITLE_SX}>
          {t('statementTitle')}
        </Typography>
        <Typography variant="body1" sx={STATEMENT_SUPPORT_SX}>
          {t('statementSupport')}
        </Typography>
      </Stack>
    </Box>
  );
}

// The free-capability claims band: one reading in the glance below the act.
function ClaimsBand() {
  return (
    <Box component="section" data-testid="landing-claims" sx={CLAIMS_SECTION_SX}>
      <List disablePadding sx={CLAIMS_LIST_SX}>
        {CLAIMS.map((claim) => (
          <ClaimRow key={claim.id} claim={claim} />
        ))}
      </List>
    </Box>
  );
}

// Renders the guest shorten act and the post-shorten register nudge. Only
// visible to anonymous visitors (useAuth().user === null) AND only when the
// runtime GUEST_SHORTEN_ENABLED flag is on (read via /config.js); loading and
// disabled both hide the act, so the form never flashes and stays hidden
// fail-safe on misconfiguration. The nudge appears AFTER a successful guest
// shorten and names the additions an account brings: the link kept with its
// use visible, the personal dashboard with click analytics, and API keys +
// MCP access.
function GuestShortenSection() {
  const { t } = useTranslation('landing');
  const { user } = useAuth();
  const flag = useGuestShortenEnabled();
  const [nudgeVisible, setNudgeVisible] = useState(false);

  const handleShortened = useCallback(() => {
    setNudgeVisible(true);
  }, []);

  if (user !== null || flag !== 'enabled') return null;

  return (
    <Box component="section" data-testid="guest-shorten-section" sx={ACT_SECTION_SX}>
      <Box sx={ACT_COLUMN_SX}>
        <ShortenCard namespace="landing" onShortened={handleShortened} />
        {nudgeVisible && (
          <Paper variant="outlined" sx={NUDGE_SX} data-testid="guest-nudge">
            <Typography variant="h6" component="h2" sx={NUDGE_TITLE_SX}>
              {t('guestNudgeTitle')}
            </Typography>
            <List dense disablePadding>
              <ListItem disableGutters data-testid="guest-nudge-feature-kept-link">
                <ListItemIcon sx={NUDGE_ICON_SX}>
                  <LinkIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={t('guestNudgeFeatureKeptLink')} />
              </ListItem>
              <ListItem disableGutters data-testid="guest-nudge-feature-dashboard">
                <ListItemIcon sx={NUDGE_ICON_SX}>
                  <DashboardIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={t('guestNudgeFeatureDashboard')} />
              </ListItem>
              <ListItem disableGutters data-testid="guest-nudge-feature-api-keys">
                <ListItemIcon sx={NUDGE_ICON_SX}>
                  <KeyIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={t('guestNudgeFeatureApiKeys')} />
              </ListItem>
            </List>
            <Button
              component={RouterLink}
              to="/register"
              variant="contained"
              color="primary"
              data-testid="guest-nudge-cta"
              sx={NUDGE_CTA_SX}
            >
              {t('guestNudgeCta')}
            </Button>
          </Paper>
        )}
      </Box>
    </Box>
  );
}

export default function LandingPage() {
  return (
    <Box component="main" data-testid="landing-page" sx={PAGE_SX}>
      <FirstSightStatement />
      <GuestShortenSection />
      <ClaimsBand />
    </Box>
  );
}
