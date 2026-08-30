import { Trans, useTranslation } from 'react-i18next';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import type { Theme } from '@mui/material/styles';
import { SPACE } from '../theme';

// The resolved statement for an address nothing answers: one title naming
// what is wrong and one supporting line naming the very address the visitor
// asked for, both bounded by the reading measure and centred. The address is
// machine matter: it reads in the theme's fixed-width technical register so a
// mistyped character is seen, while the sentence around it stays ink prose —
// severity comes from ink, never a second hue. Exactly one accent act — the
// return to the shortener — carries the whole surface's colour, because the
// condition (no page at this address) is already fully stated.

const PAGE_SX = { py: { xs: 6, md: 10 } } as const;

const STATEMENT_COLUMN_SX = {
  maxWidth: `${SPACE.measure}px`,
  mx: 'auto',
  width: '100%',
  px: 2,
  textAlign: 'center',
} as const;

const STATEMENT_TITLE_SX = { color: 'text.primary' } as const;

const STATEMENT_SUPPORT_SX = { color: 'text.secondary', lineHeight: 1.6 } as const;

// The visited address reads in the theme's fixed-width technical register: a
// character-exact string must be read character-exactly, because a mistyped
// address fails late. Size and ink stay the supporting line's own step, and
// breaking anywhere keeps a long address inside the reading measure. (The
// optional chain keeps the address legible under a theme that predates the
// register.)
const VISITED_ADDRESS_SX = {
  fontFamily: (theme: Theme) => theme.typography.technical?.fontFamily,
  wordBreak: 'break-all',
} as const;

const RETURN_ACT_SX = { mt: 3 } as const;

const HOME_PATH = '/';

export default function NotFoundPage() {
  const { t } = useTranslation('notFound');
  const { pathname } = useLocation();
  return (
    <Box component="main" data-testid="not-found-page" sx={PAGE_SX}>
      <Stack spacing={2} sx={STATEMENT_COLUMN_SX} data-testid="not-found-statement">
        <Typography variant="h3" component="h1" sx={STATEMENT_TITLE_SX}>
          {t('title')}
        </Typography>
        <Typography variant="body1" sx={STATEMENT_SUPPORT_SX}>
          <Trans
            t={t}
            i18nKey="statement"
            values={{ address: pathname }}
            components={{
              address: (
                <Box component="span" sx={VISITED_ADDRESS_SX} data-testid="not-found-address" />
              ),
            }}
          />
        </Typography>
        <Button
          component={RouterLink}
          to={HOME_PATH}
          variant="contained"
          color="primary"
          sx={RETURN_ACT_SX}
          data-testid="not-found-back"
        >
          {t('action')}
        </Button>
      </Stack>
    </Box>
  );
}
