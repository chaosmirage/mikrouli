import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import type { Theme } from '@mui/material/styles';

// Module-level style constants (static, evaluated once)
const HERO_PADDING_Y = { xs: 6, sm: 10, md: 14 };
const FEATURES_PADDING_Y = { xs: 6, sm: 8, md: 10 };
const BOTTOM_PADDING_Y = { xs: 6, sm: 8, md: 12 };

const HERO_SECTION_SX = { py: HERO_PADDING_Y, bgcolor: 'background.paper' } as const;
const FEATURES_SECTION_SX = { py: FEATURES_PADDING_Y, bgcolor: 'background.default' } as const;
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

const BOTTOM_HEADING_SX = { fontWeight: 700, letterSpacing: '-0.01em' } as const;

const BOTTOM_SUBTITLE_SX = { color: 'text.secondary', maxWidth: 440 } as const;

const BOTTOM_CTA_BUTTON_SX = { px: 4.5, py: 1.25 } as const;

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
    <Typography
      variant="h2"
      component="h1"
      data-testid="landing-headline"
      sx={HEADLINE_SX}
    >
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
          <HighlightedHeadline prefix={t('heroHeadlinePrefix')} highlight={t('heroHeadlineHighlight')} />
          <Typography variant="h6" component="p" sx={HERO_SUBHEADLINE_SX}>
            {t('heroSubheadline')}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center" sx={HERO_BUTTON_STACK_SX}>
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
          <FeatureCard emoji="⚡" title={t('feature1Title')} body={t('feature1Body')} testId="landing-feature-1" />
          <FeatureCard emoji="📈" title={t('feature2Title')} body={t('feature2Body')} testId="landing-feature-2" />
          <FeatureCard emoji="🔌" title={t('feature3Title')} body={t('feature3Body')} testId="landing-feature-3" />
        </Box>
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

export default function LandingPage() {
  return (
    <Box component="main" data-testid="landing-page">
      <HeroSection />
      <FeaturesSection />
      <BottomCtaSection />
    </Box>
  );
}
