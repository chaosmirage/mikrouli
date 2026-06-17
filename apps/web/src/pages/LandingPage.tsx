import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import DashboardIcon from '@mui/icons-material/Dashboard';
import KeyIcon from '@mui/icons-material/Key';
import type { Theme } from '@mui/material/styles';
import ShortenCard from '../components/ShortenCard';
import { useAuth } from '../auth/AuthContext';
import { useGuestShortenEnabled } from '../hooks/useGuestShortenEnabled';

// Module-level style constants (static, evaluated once)
const HERO_PADDING_Y = { xs: 6, sm: 10, md: 14 };
const FEATURES_PADDING_Y = { xs: 6, sm: 8, md: 10 };
const AGENT_PADDING_Y = { xs: 6, sm: 8, md: 10 };
const BOTTOM_PADDING_Y = { xs: 6, sm: 8, md: 12 };

const HERO_SECTION_SX = { py: HERO_PADDING_Y, bgcolor: 'background.paper' } as const;
const FEATURES_SECTION_SX = { py: FEATURES_PADDING_Y, bgcolor: 'background.default' } as const;
const AGENT_SECTION_SX = { py: AGENT_PADDING_Y, bgcolor: 'background.paper' } as const;
const BOTTOM_SECTION_SX = { py: BOTTOM_PADDING_Y, bgcolor: 'background.paper' } as const;

const FEATURE_CARD_SX = {
  p: 4,
  display: 'flex',
  flexDirection: 'column',
  gap: 1.5,
  height: '100%',
} as const;

const FEATURE_CARD_BODY_SX = { color: 'text.secondary' } as const;
const FEATURE_CARD_TITLE_SX = { color: 'text.primary' } as const;

const HEADLINE_SX = {
  maxWidth: 720,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  lineHeight: 1.1,
} as const;

function highlightSpanSx(theme: Theme) {
  return {
    textDecoration: 'underline',
    textDecorationColor: theme.palette.warning.main,
    textDecorationThickness: '4px',
    textUnderlineOffset: '6px',
  };
}

const HERO_SUBHEADLINE_SX = {
  color: 'text.secondary',
  maxWidth: 560,
  fontWeight: 400,
  lineHeight: 1.6,
} as const;

const HERO_BUTTON_STACK_SX = { pt: 1 } as const;

const CTA_BUTTON_SX = { px: 4, py: 1.25 } as const;

const FEATURES_MB_SX = { mb: 6 } as const;

const FEATURES_SUBTITLE_SX = { color: 'text.secondary', maxWidth: 480 } as const;

const FEATURES_HEADING_SX = { fontWeight: 700, letterSpacing: '-0.01em' } as const;

const FEATURES_GRID_SX = {
  display: 'grid',
  gap: 2.5,
  gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
} as const;

const AGENT_EYEBROW_SX = {
  color: 'primary.main',
  fontWeight: 600,
  letterSpacing: '0.08em',
} as const;

const AGENT_HEADING_SX = { fontWeight: 700, letterSpacing: '-0.01em' } as const;

const AGENT_BODY_SX = { color: 'text.secondary', maxWidth: 520 } as const;

const AGENT_CTA_BUTTON_SX = { px: 4, py: 1.25 } as const;

const BOTTOM_HEADING_SX = { fontWeight: 700, letterSpacing: '-0.01em' } as const;

const BOTTOM_SUBTITLE_SX = { color: 'text.secondary', maxWidth: 440 } as const;

const BOTTOM_CTA_BUTTON_SX = { px: 4.5, py: 1.25 } as const;

// Guest shorten section: sits between the hero and the features section, only
// for anonymous visitors when the runtime GUEST_SHORTEN_ENABLED flag is on.
const GUEST_SECTION_SX = { py: { xs: 4, sm: 6 }, bgcolor: 'background.default' } as const;
const GUEST_CARD_SX = { p: { xs: 2, sm: 4 }, maxWidth: 640, mx: 'auto', width: '100%' } as const;
const GUEST_TITLE_SX = { mb: 2, fontWeight: 700, textAlign: 'center' } as const;
const GUEST_NUDGE_SX = { mt: 3, p: { xs: 2, sm: 3 }, bgcolor: 'action.hover' } as const;
const GUEST_NUDGE_TITLE_SX = { mb: 1, fontWeight: 600 } as const;
const GUEST_NUDGE_CTA_SX = { mt: 2 } as const;

interface FeatureCardProps {
  emoji: string;
  title: string;
  body: string;
  testId: string;
}
function FeatureCard({ emoji, title, body, testId }: FeatureCardProps) {
  return (
    <Paper variant="outlined" data-testid={testId} sx={FEATURE_CARD_SX}>
      <Typography variant="h4" component="div" aria-hidden="true">
        {emoji}
      </Typography>
      <Typography variant="h6" component="h3" sx={FEATURE_CARD_TITLE_SX}>
        {title}
      </Typography>
      <Typography variant="body2" sx={FEATURE_CARD_BODY_SX}>
        {body}
      </Typography>
    </Paper>
  );
}

interface HighlightedHeadlineProps {
  prefix: string;
  highlight: string;
}
function HighlightedHeadline({ prefix, highlight }: HighlightedHeadlineProps) {
  return (
    <Typography variant="h2" component="h1" data-testid="landing-headline" sx={HEADLINE_SX}>
      {prefix}{' '}
      <Box component="span" sx={highlightSpanSx}>
        {highlight}
      </Box>
    </Typography>
  );
}

function HeroSection() {
  const { t } = useTranslation('landing');
  return (
    <Box component="section" data-testid="landing-hero" sx={HERO_SECTION_SX}>
      <Container maxWidth="md">
        <Stack spacing={3} alignItems="center" textAlign="center">
          <HighlightedHeadline
            prefix={t('heroHeadlinePrefix')}
            highlight={t('heroHeadlineHighlight')}
          />
          <Typography variant="h6" component="p" sx={HERO_SUBHEADLINE_SX}>
            {t('heroSubheadline')}
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems="center"
            sx={HERO_BUTTON_STACK_SX}
          >
            <Button
              component={RouterLink}
              to="/register"
              variant="contained"
              color="primary"
              size="large"
              data-testid="landing-cta-register"
              sx={CTA_BUTTON_SX}
            >
              {t('ctaGetStarted')} →
            </Button>
            <Button
              component={RouterLink}
              to="/login"
              variant="outlined"
              size="large"
              data-testid="landing-cta-login"
              sx={CTA_BUTTON_SX}
            >
              {t('ctaSignIn')}
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

function FeaturesSection() {
  const { t } = useTranslation('landing');
  return (
    <Box component="section" data-testid="landing-features" sx={FEATURES_SECTION_SX}>
      <Container maxWidth="lg">
        <Stack spacing={1} alignItems="center" textAlign="center" sx={FEATURES_MB_SX}>
          <Typography variant="h3" component="h2" sx={FEATURES_HEADING_SX}>
            {t('featuresTitle')}
          </Typography>
          <Typography variant="body1" sx={FEATURES_SUBTITLE_SX}>
            {t('featuresSubtitle')}
          </Typography>
        </Stack>
        <Box sx={FEATURES_GRID_SX}>
          <FeatureCard
            emoji="⚡"
            title={t('feature1Title')}
            body={t('feature1Body')}
            testId="landing-feature-1"
          />
          <FeatureCard
            emoji="📈"
            title={t('feature2Title')}
            body={t('feature2Body')}
            testId="landing-feature-2"
          />
          <FeatureCard
            emoji="🔌"
            title={t('feature3Title')}
            body={t('feature3Body')}
            testId="landing-feature-3"
          />
        </Box>
      </Container>
    </Box>
  );
}

// Advertises REST and MCP agent access; links to the dedicated connect page.
function AgentSection() {
  const { t } = useTranslation('landing');
  return (
    <Box component="section" data-testid="agent-section" sx={AGENT_SECTION_SX}>
      <Container maxWidth="md">
        <Stack spacing={3} alignItems="center" textAlign="center">
          <Typography variant="overline" component="p" sx={AGENT_EYEBROW_SX}>
            {t('agentEyebrow')}
          </Typography>
          <Typography variant="h3" component="h2" sx={AGENT_HEADING_SX}>
            {t('agentTitle')}
          </Typography>
          <Typography variant="body1" sx={AGENT_BODY_SX}>
            {t('agentBody')}
          </Typography>
          <Button
            component={RouterLink}
            to="/connect"
            variant="contained"
            color="primary"
            size="large"
            data-testid="agent-section-cta"
            sx={AGENT_CTA_BUTTON_SX}
          >
            {t('agentCta')} →
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}

function BottomCtaSection() {
  const { t } = useTranslation('landing');
  return (
    <Box component="section" data-testid="landing-bottom-cta" sx={BOTTOM_SECTION_SX}>
      <Container maxWidth="md">
        <Stack spacing={3} alignItems="center" textAlign="center">
          <Typography variant="h3" component="h2" sx={BOTTOM_HEADING_SX}>
            {t('bottomCtaTitle')}
          </Typography>
          <Typography variant="body1" sx={BOTTOM_SUBTITLE_SX}>
            {t('bottomCtaBody')}
          </Typography>
          <Button
            component={RouterLink}
            to="/register"
            variant="contained"
            color="primary"
            size="large"
            data-testid="landing-bottom-cta-register"
            sx={BOTTOM_CTA_BUTTON_SX}
          >
            {t('ctaGetStarted')} →
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}

// Renders the guest shorten card and the post-shorten sign-up nudge. Only
// visible to anonymous visitors (useAuth().user === null) AND only when the
// runtime GUEST_SHORTEN_ENABLED flag is on (read via /config.js). The nudge
// appears AFTER a successful Guest shorten and names exactly two features:
// the personal dashboard with click analytics, and API keys + MCP access.
function GuestShortenSection() {
  const { t } = useTranslation('landing');
  const { user } = useAuth();
  const flag = useGuestShortenEnabled();
  const [nudgeVisible, setNudgeVisible] = useState(false);

  const handleShortened = useCallback(() => {
    setNudgeVisible(true);
  }, []);

  // Authenticated visitors never see the guest form (they have the dashboard);
  // the loading state is hidden to avoid a flash before the flag resolves, and
  // disabled hides the form fail-safe.
  if (user !== null || flag !== 'enabled') return null;

  return (
    <Box component="section" data-testid="guest-shorten-section" sx={GUEST_SECTION_SX}>
      <Container maxWidth="md">
        <Card sx={GUEST_CARD_SX} data-testid="guest-shorten-card">
          <CardContent>
            <Typography variant="h5" component="h2" sx={GUEST_TITLE_SX}>
              {t('guestShortenTitle')}
            </Typography>
            <ShortenCard namespace="landing" onShortened={handleShortened} />
            {nudgeVisible && (
              <Paper variant="outlined" sx={GUEST_NUDGE_SX} data-testid="guest-nudge">
                <Typography variant="h6" component="h3" sx={GUEST_NUDGE_TITLE_SX}>
                  {t('guestNudgeTitle')}
                </Typography>
                <List dense disablePadding>
                  <ListItem disableGutters data-testid="guest-nudge-feature-dashboard">
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <DashboardIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={t('guestNudgeFeatureDashboard')} />
                  </ListItem>
                  <ListItem disableGutters data-testid="guest-nudge-feature-api-keys">
                    <ListItemIcon sx={{ minWidth: 36 }}>
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
                  sx={GUEST_NUDGE_CTA_SX}
                >
                  {t('guestNudgeCta')} →
                </Button>
              </Paper>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}

export default function LandingPage() {
  return (
    <Box component="main" data-testid="landing-page">
      <HeroSection />
      <GuestShortenSection />
      <FeaturesSection />
      <AgentSection />
      <BottomCtaSection />
    </Box>
  );
}
