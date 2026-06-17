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

export default function TermsPage() {
  const { t } = useTranslation('legal');
  return (
    <Box component="main" data-testid="terms-page">
      <Container maxWidth="md" sx={PAGE_SX}>
        <Stack spacing={4}>
          <Stack spacing={1}>
            <Typography variant="h3" component="h1" fontWeight={700}>
              {t('terms.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('terms.lastUpdated')}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {t('terms.intro')}
            </Typography>
          </Stack>
          <Paper variant="outlined" sx={SECTION_SX} data-testid="terms-lawful-use">
            <Stack spacing={2}>
              <Typography variant="h5" component="h2">
                {t('terms.lawfulUseTitle')}
              </Typography>
              <Typography variant="body2">{t('terms.lawfulUse')}</Typography>
            </Stack>
          </Paper>
          <Paper variant="outlined" sx={SECTION_SX} data-testid="terms-user-responsibility">
            <Stack spacing={2}>
              <Typography variant="h5" component="h2">
                {t('terms.userResponsibilityTitle')}
              </Typography>
              <Typography variant="body2">{t('terms.userResponsibility')}</Typography>
            </Stack>
          </Paper>
          <Paper variant="outlined" sx={SECTION_SX} data-testid="terms-operator-disclaimer">
            <Stack spacing={2}>
              <Typography variant="h5" component="h2">
                {t('terms.operatorDisclaimerTitle')}
              </Typography>
              <Typography variant="body2">{t('terms.operatorDisclaimer')}</Typography>
            </Stack>
          </Paper>
          <Paper variant="outlined" sx={SECTION_SX} data-testid="terms-link-retention">
            <Stack spacing={2}>
              <Typography variant="h5" component="h2">
                {t('terms.linkRetentionTitle')}
              </Typography>
              <Typography variant="body2">{t('terms.linkRetention')}</Typography>
            </Stack>
          </Paper>
          <Paper variant="outlined" sx={SECTION_SX} data-testid="terms-contact">
            <Stack spacing={2}>
              <Typography variant="h5" component="h2">
                {t('terms.contactTitle')}
              </Typography>
              <Typography variant="body2">{t('terms.contact')}</Typography>
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
