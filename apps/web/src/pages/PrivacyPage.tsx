import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';

import { SPACE } from '../theme';

// The privacy reading: the same family as the terms text -- the pair of texts
// at the head, the measure-bounded column, the strongest ink relation, no
// accent. The one surface whose whole function is sustained reading.

// The page zone: the whole content zone at the standing page inset, so the
// head and the reading both stand where the reference frame places them.
const ZONE_SX = { px: { xs: 3, md: 15 } } as const;

const PAGE_SX = { pt: { xs: 3, md: 7 }, pb: { xs: 8, md: 10 } } as const;

// The head zone spans the whole content zone: the pair of texts stands there
// and the hairline that closes the head reads across the zone, not just
// across the measure.
const HEAD_ZONE_SX = { width: '100%' } as const;

// The reading column: bounded by the theme factory's reading measure, at the
// zone's left, carrying the strongest ink relation so the whole reading
// inherits maximum legibility. A wider viewport buys margins, never longer
// lines.
const READING_COLUMN_SX = {
  maxWidth: `${SPACE.measure}px`,
  mr: 'auto',
  mt: 6,
  color: 'text.primary',
} as const;

// The open text's reach and its sibling: one homogeneous pair, neither hidden
// behind the other. The open one carries the strongest ink; the sibling
// states itself one step quieter in the same family.
const OPEN_REACH_SX = { color: 'text.primary' } as const;
const SIBLING_REACH_SX = { color: 'text.secondary' } as const;

// Body matter set one-and-a-half its step for sustained reading.
const READING_TEXT_SX = { lineHeight: 1.5 } as const;

// The return reach states itself in ink; the underline carries the
// affordance — no accent exists on the reading surface.
const REACH_SX = { color: 'text.primary' } as const;

const TERMS_PATH = '/terms';
const PRIVACY_PATH = '/privacy';

export default function PrivacyPage() {
  const { t } = useTranslation(['legal', 'common']);
  const navigate = useNavigate();
  const returnToPreviousPlace = useCallback(() => navigate(-1), [navigate]);
  return (
    <Box component="main" data-testid="privacy-page" sx={PAGE_SX}>
      <Box sx={ZONE_SX}>
        {/* The pair of legal texts: the open text's reach and its sibling
            stand together at the head, rendered identically, so neither text
            is hidden behind the other; the hairline closes the head. */}
        <Box sx={HEAD_ZONE_SX}>
          <Stack direction="row" spacing={4} data-testid="legal-pair">
            <Link
              component={RouterLink}
              to={PRIVACY_PATH}
              variant="h5"
              aria-current="page"
              sx={OPEN_REACH_SX}
            >
              {t('common:privacy')}
            </Link>
            <Link component={RouterLink} to={TERMS_PATH} variant="h5" sx={SIBLING_REACH_SX}>
              {t('common:terms')}
            </Link>
          </Stack>
          <Divider sx={{ mt: 1.5 }} />
        </Box>
        <Stack spacing={4.5} sx={READING_COLUMN_SX} data-testid="privacy-reading">
          <Stack spacing={3}>
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
      </Box>
    </Box>
  );
}
