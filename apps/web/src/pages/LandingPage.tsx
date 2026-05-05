import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';

const HERO_PADDING_Y = { xs: 6, sm: 10, md: 14 };
const FEATURES_PADDING_Y = { xs: 6, sm: 8, md: 10 };
const BOTTOM_PADDING_Y = { xs: 6, sm: 8, md: 12 };

interface FeatureCardProps {
  emoji: string;
  title: string;
  body: string;
  testId: string;
}
function FeatureCard({ emoji, title, body, testId }: FeatureCardProps) {
  return (
    <Paper
      variant="outlined"
      data-testid={testId}
      sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%' }}
    >
      <Typography variant="h4" component="div" aria-hidden="true">
        {emoji}
      </Typography>
      <Typography variant="h6" component="h3" sx={{ color: 'text.primary' }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
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
      sx={{ maxWidth: 720, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}
    >
      {prefix}{' '}
      <Box
        component="span"
        sx={{
          textDecoration: 'underline',
          textDecorationColor: 'warning.main',
          textDecorationThickness: '4px',
          textUnderlineOffset: '6px',
        }}
      >
        {highlight}
      </Box>
    </Typography>
  );
}

function HeroSection() {
  const { t } = useTranslation('landing');
  return (
    <Box component="section" data-testid="landing-hero" sx={{ py: HERO_PADDING_Y, bgcolor: 'background.paper' }}>
      <Container maxWidth="md">
        <Stack spacing={3} alignItems="center" textAlign="center">
          <HighlightedHeadline prefix={t('heroHeadlinePrefix')} highlight={t('heroHeadlineHighlight')} />
          <Typography variant="h6" component="p" sx={{ color: 'text.secondary', maxWidth: 560, fontWeight: 400, lineHeight: 1.6 }}>
            {t('heroSubheadline')}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center" sx={{ pt: 1 }}>
            <Button
              component={RouterLink}
              to="/register"
              variant="contained"
              color="primary"
              size="large"
              data-testid="landing-cta-register"
              sx={{ px: 4, py: 1.25 }}
            >
              {t('ctaGetStarted')} →
            </Button>
            <Button
              component={RouterLink}
              to="/login"
              variant="outlined"
              size="large"
              data-testid="landing-cta-login"
              sx={{ px: 4, py: 1.25 }}
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
    <Box component="section" data-testid="landing-features" sx={{ py: FEATURES_PADDING_Y, bgcolor: 'background.default' }}>
      <Container maxWidth="lg">
        <Stack spacing={1} alignItems="center" textAlign="center" sx={{ mb: 6 }}>
          <Typography variant="h3" component="h2" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
            {t('featuresTitle')}
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 480 }}>
            {t('featuresSubtitle')}
          </Typography>
        </Stack>
        <Box
          sx={{
            display: 'grid',
            gap: 2.5,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          }}
        >
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
    <Box component="section" data-testid="landing-bottom-cta" sx={{ py: BOTTOM_PADDING_Y, bgcolor: 'background.paper' }}>
      <Container maxWidth="md">
        <Stack spacing={3} alignItems="center" textAlign="center">
          <Typography variant="h3" component="h2" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
            {t('bottomCtaTitle')}
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 440 }}>
            {t('bottomCtaBody')}
          </Typography>
          <Button
            component={RouterLink}
            to="/register"
            variant="contained"
            color="primary"
            size="large"
            data-testid="landing-bottom-cta-register"
            sx={{ px: 4.5, py: 1.25 }}
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
