import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Link from '@mui/material/Link';

const PAGE_SX = { py: { xs: 4, md: 8 } } as const;

const SECTION_SX = {
  p: { xs: 3, md: 4 },
} as const;

export default function PrivacyPage() {
  const { t } = useTranslation('legal');
  return (
    <Box component="main" data-testid="privacy-page">
      <Container maxWidth="md" sx={PAGE_SX}>
        <Stack spacing={4}>
          <Stack spacing={1}>
            <Typography variant="h3" component="h1" fontWeight={700}>
              {t('privacy.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('privacy.lastUpdated')}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {t('privacy.intro')}
            </Typography>
          </Stack>
          <Paper variant="outlined" sx={SECTION_SX} data-testid="privacy-data-collected">
            <Stack spacing={2}>
              <Typography variant="h5" component="h2">
                {t('privacy.dataCollectedTitle')}
              </Typography>
              <Typography variant="body2">{t('privacy.dataCollected')}</Typography>
            </Stack>
          </Paper>
          <Paper variant="outlined" sx={SECTION_SX} data-testid="privacy-analytics">
            <Stack spacing={2}>
              <Typography variant="h5" component="h2">
                {t('privacy.analyticsTitle')}
              </Typography>
              <Typography variant="body2">{t('privacy.analytics')}</Typography>
            </Stack>
          </Paper>
          <Paper variant="outlined" sx={SECTION_SX} data-testid="privacy-retention">
            <Stack spacing={2}>
              <Typography variant="h5" component="h2">
                {t('privacy.retentionTitle')}
              </Typography>
              <Typography variant="body2">{t('privacy.retention')}</Typography>
            </Stack>
          </Paper>
          <Paper variant="outlined" sx={SECTION_SX} data-testid="privacy-contact">
            <Stack spacing={2}>
              <Typography variant="h5" component="h2">
                {t('privacy.contactTitle')}
              </Typography>
              <Typography variant="body2">{t('privacy.contact')}</Typography>
              <Link href="mailto:support@mikrou.li" underline="hover" variant="body2">
                support@mikrou.li
              </Link>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
