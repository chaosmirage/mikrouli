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

// The landing is the one full-viewport composition: it stands outside the
// contained width and composes on the thirds — the display statement at the
// upper third-line intersection, the act inside the same glance, the claims
// band in the next downward glance. Spacing follows the five-step space ladder
// over the theme's base unit (inline = 1, element = 2, block = 3, zone = 5).

// The composition's left margin: the content column opens 120px into the
// viewport at desktop widths (the full-viewport landing's own margin rhythm).
const CONTENT_GUTTER_SX = {
  px: { xs: 3, md: 15 },
  minHeight: 'calc(100vh - 64px)',
  display: 'flex',
  flexDirection: 'column',
} as const;

// The display statement: the first-sight statement at the display step,
// weight-led and tightened, in the strongest ink directly on the canvas.
const STATEMENT_TITLE_SX = {
  color: 'text.primary',
  fontWeight: 800,
  letterSpacing: '-0.03em',
  lineHeight: 1.05,
  fontSize: { xs: '2.5rem', sm: '3.5rem', md: '6rem' },
} as const;

const STATEMENT_SUPPORT_SX = {
  color: 'text.secondary',
  lineHeight: 1.6,
  maxWidth: 640,
  mt: 2,
} as const;

// The one-act row: the entering and the confirm side by side, bounded by the
// reading measure so statement and act share one glance.
const ACT_SECTION_SX = { mt: 5, maxWidth: 640 } as const;

const ACT_ROW_SX = {
  flexDirection: { xs: 'column', sm: 'row' },
  gap: 2,
  alignItems: { sm: 'center' },
} as const;

const FAILURE_POSITION_SX = { mt: 1.5, color: 'text.disabled' } as const;

// The claims band stands in the next downward glance, a full zone below the
// act, so the act is never scanned past. One band, four entries, at
// space.element between entries.
const CLAIMS_SECTION_SX = { mt: 9 } as const;

const CLAIMS_GRID_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
  columnGap: 5,
  rowGap: 4,
} as const;

// Comparable claims look comparable: every entry is the identical shape — one
// claim line, one comparate line, an optional reach — differing only in
// content.
const CLAIM_TITLE_SX = { color: 'text.primary', fontWeight: 600 } as const;
const CLAIM_COMPARATE_SX = { color: 'text.disabled', mt: 0.5 } as const;
const CLAIM_REACH_SX = { color: 'primary.main', fontWeight: 600, fontSize: '0.875rem', mt: 1 } as const;

const FOOTER_SX = { mt: 'auto', pt: 14, pb: 5 } as const;


const NUDGE_SX = { mt: 3, p: { xs: 2, sm: 3 }, maxWidth: 640 } as const;
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

function ClaimEntryBlock({ claim }: { claim: ClaimEntry }) {
  const { t } = useTranslation('landing');
  return (
    <Stack data-testid={`landing-claim-${claim.id}`}>
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
          underline="hover"
          data-testid={`landing-claim-${claim.id}-reach`}
          sx={CLAIM_REACH_SX}
        >
          {t(claim.reach.labelKey)}
        </Link>
      )}
    </Stack>
  );
}

// The first-sight statement: what the product is, in the strongest ink
// directly on the canvas — no card, no illustration, no gradient.
function FirstSightStatement() {
  const { t } = useTranslation('landing');
  return (
    <Box component="section" data-testid="landing-statement">
      <Typography variant="h1" component="h1" sx={STATEMENT_TITLE_SX}>
        {t('statementTitle')}
      </Typography>
      <Typography variant="body1" sx={STATEMENT_SUPPORT_SX}>
        {t('statementSupport')}
      </Typography>
    </Box>
  );
}

// The free-capability claims band: one band of four comparable entries in the
// glance below the act.
function ClaimsBand() {
  return (
    <Box component="section" data-testid="landing-claims" sx={CLAIMS_SECTION_SX}>
      <Box sx={CLAIMS_GRID_SX}>
        {CLAIMS.map((claim) => (
          <ClaimEntryBlock key={claim.id} claim={claim} />
        ))}
      </Box>
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
      <Box sx={ACT_ROW_SX}>
        <ShortenCard namespace="landing" onShortened={handleShortened} bare />
      </Box>
      <Typography variant="caption" sx={FAILURE_POSITION_SX}>
        {t('failurePosition')}
      </Typography>
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
  );
}

// The footer's legal reaches stand at the landing's foot like on every shell
// surface (the shell carries them on protected routes; the full-viewport
// landing carries its own pair).
function LandingFooter() {
  const { t } = useTranslation('landing');
  return (
    <Box component="footer" sx={FOOTER_SX}>
      <Stack direction="row" spacing={2}>
        <Link
          component={RouterLink}
          to="/terms"
          underline="hover"
          color="text.secondary"
          data-testid="footer-terms"
        >
          {t('footerTerms')}
        </Link>
        <Link
          component={RouterLink}
          to="/privacy"
          underline="hover"
          color="text.secondary"
          data-testid="footer-privacy"
        >
          {t('footerPrivacy')}
        </Link>
      </Stack>
    </Box>
  );
}

export default function LandingPage() {
  return (
    <Box component="main" data-testid="landing-page" sx={CONTENT_GUTTER_SX}>
      <Box sx={PAGE_PT_SX}>
        <FirstSightStatement />
        <GuestShortenSection />
        <ClaimsBand />
        <LandingFooter />
      </Box>
    </Box>
  );
}

const PAGE_PT_SX = {
  pt: { xs: 6, md: 14 },
  bgcolor: 'background.default',
  flex: '1 1 auto',
  display: 'flex',
  flexDirection: 'column',
} as const;
