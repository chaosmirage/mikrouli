import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';

import { SPACE } from '../theme';

const PAGE_SX = { py: { xs: 4, md: 8 } } as const;

// The reading column: bounded by the theme factory's SPACE.measure -- the one
// reading measure the whole app reads, since sustained reading is the one
// activity whose visual condition is the measure itself; a wider viewport
// buys margins and calm, never longer lines -- centered on the contained
// width, and carrying the strongest ink relation so the whole reading
// inherits maximum legibility.
const READING_COLUMN_SX = {
  maxWidth: `${SPACE.measure}px`,
  mx: 'auto',
  color: 'text.primary',
} as const;

// Body matter set at one-and-a-half its step for sustained reading.
const READING_TEXT_SX = { lineHeight: 1.5 } as const;

// No accent exists on the reading surface: every reach states itself in ink,
// with the underline carrying the affordance.
const REACH_SX = { color: 'text.primary' } as const;

const TERMS_PATH = '/terms';
const PRIVACY_PATH = '/privacy';

export default function PrivacyPage() {
  const { t } = useTranslation(['legal', 'common']);
  const navigate = useNavigate();
  const returnToPreviousPlace = useCallback(() => navigate(-1), [navigate]);
  return (
    <Box component="main" data-testid="privacy-page">
      <Container maxWidth="md" sx={PAGE_SX}>
        <Stack spacing={3} sx={READING_COLUMN_SX} data-testid="privacy-reading">
          {/* The pair of legal texts: the open text's reach and its sibling
              stand together at the head, rendered identically, so neither
              text is hidden behind the other. */}
          <Stack direction="row" spacing={2} data-testid="legal-pair">
            <Link
              component={RouterLink}
              to={PRIVACY_PATH}
              variant="body1"
              aria-current="page"
              sx={REACH_SX}
            >
              {t('common:privacy')}
            </Link>
            <Link component={RouterLink} to={TERMS_PATH} variant="body1" sx={REACH_SX}>
              {t('common:terms')}
            </Link>
          </Stack>
          <Stack spacing={2}>
            <Typography variant="h3" component="h1">
              {t('privacy.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('privacy.lastUpdated')}
            </Typography>
            <Typography variant="body1" sx={READING_TEXT_SX}>
              {t('privacy.intro')}
            </Typography>
          </Stack>
          <Stack spacing={2} data-testid="privacy-data-collected">
            <Typography variant="h5" component="h2">
              {t('privacy.dataCollectedTitle')}
            </Typography>
            <Typography variant="body1" sx={READING_TEXT_SX}>
              {t('privacy.dataCollected')}
            </Typography>
          </Stack>
          <Stack spacing={2} data-testid="privacy-analytics">
            <Typography variant="h5" component="h2">
              {t('privacy.analyticsTitle')}
            </Typography>
            <Typography variant="body1" sx={READING_TEXT_SX}>
              {t('privacy.analytics')}
            </Typography>
          </Stack>
          <Stack spacing={2} data-testid="privacy-retention">
            <Typography variant="h5" component="h2">
              {t('privacy.retentionTitle')}
            </Typography>
            <Typography variant="body1" sx={READING_TEXT_SX}>
              {t('privacy.retention')}
            </Typography>
          </Stack>
          <Stack spacing={2} data-testid="privacy-contact">
            <Typography variant="h5" component="h2">
              {t('privacy.contactTitle')}
            </Typography>
            <Typography variant="body1" sx={READING_TEXT_SX}>
              {t('privacy.contact')}
            </Typography>
            <Link href="mailto:support@mikrou.li" variant="body1" sx={REACH_SX}>
              support@mikrou.li
            </Link>
          </Stack>
          {/* The return: one activation restores the place the reading was
              reached from, with nothing asked beyond the reading. */}
          <Link
            component="button"
            type="button"
            variant="body1"
            onClick={returnToPreviousPlace}
            sx={REACH_SX}
            data-testid="legal-back"
          >
            {t('back')}
          </Link>
        </Stack>
      </Container>
    </Box>
  );
}
