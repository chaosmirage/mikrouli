import { FormEvent, useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { resolveOauthErrorKey } from './oauth-error';

const HTTP_UNAUTHORIZED = 401;

// Column rhythm (frame S3): the entering is one narrow centered column — 400px
// at the desktop register — with the naming at the title register directly on
// the canvas, the shorter federated path staged first, a hairline "or" seam,
// then the credentials path. Gap ordering: a zone between the column's parts,
// a block around the seam, the element step within one path.
const LOGIN_PAGE_SX = { pt: { xs: 4, sm: 3 }, pb: { xs: 4, sm: 6 } } as const;
const ENTERING_COLUMN_SX = { width: { xs: '100%', sm: '400px' }, mx: 'auto' } as const;
const ENTERING_TITLE_SX = {
  fontSize: { xs: '2rem', sm: '3rem' },
  lineHeight: { xs: '40px', sm: '56px' },
} as const;
const CONTROL_SX = { height: 40 } as const;
// The credentials family's entering fields (frame S3-B3): the raised surface
// with the hairline edge and the 14px inner register. Scoped here until the
// form system's owner lifts the same values into the theme's field overrides.
const FIELD_FAMILY_SX = {
  '& .MuiOutlinedInput-root': { backgroundColor: 'surface.raised' },
  '& .MuiInputBase-input': { fontSize: '0.875rem' },
  '& .MuiInputLabel-root': { fontSize: '0.875rem', color: 'text.disabled' },
  '& .MuiFormLabel-asterisk': { display: 'none' },
} as const;
const PATH_ELEMENT_GAP = 2;
const PATH_ZONE_GAP = 5;
const SEAM_GAP = 3;
const LOGIN_EMAIL_INPUT_PROPS = { 'data-testid': 'login-email' } as const;
const LOGIN_PASSWORD_INPUT_PROPS = { 'data-testid': 'login-password' } as const;

// The seam between the two paths: two hairlines with the "or" reading between
// them, so the credentials path reads as the second path of one family, not a
// second form.
const SEAM_SX = { display: 'flex', alignItems: 'center', gap: 3 } as const;
const SEAM_LINE_SX = { flex: 1, height: '1px', bgcolor: 'divider' } as const;
const SEAM_WORD_SX = { color: 'text.disabled' } as const;

function mapLoginError(err: unknown): string {
  if (err instanceof ApiError && err.status === HTTP_UNAUTHORIZED) return 'errors:unauthorized';
  return 'errors:generic';
}

async function attemptLogin(
  login: (email: string, password: string) => Promise<void>,
  email: string,
  password: string,
): Promise<string | null> {
  try {
    await login(email, password);
    return null;
  } catch (err) {
    return mapLoginError(err);
  }
}

export default function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login, loginWithGithub } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Resolved once per render — no Effect needed (the search param is stable
  // across this render; derived values belong to the render pass).
  const oauthErrorKey = resolveOauthErrorKey(searchParams.get('error'));

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setLoading(true);
      const key = await attemptLogin(login, email, password);
      setErrorKey(key);
      setLoading(false);
      if (!key) navigate('/dashboard');
    },
    [login, email, password, navigate],
  );

  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value),
    [],
  );
  const handlePasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value),
    [],
  );

  return (
    <Container maxWidth="sm" sx={LOGIN_PAGE_SX} data-testid="login-page">
      <Stack sx={ENTERING_COLUMN_SX}>
        <Typography variant="title" component="h1" sx={ENTERING_TITLE_SX}>
          {t('auth:signIn')}
        </Typography>
        <Stack spacing={PATH_ELEMENT_GAP} component="section" sx={{ mt: PATH_ZONE_GAP }}>
          <Button
            variant="outlined"
            onClick={loginWithGithub}
            fullWidth
            sx={CONTROL_SX}
            data-testid="login-github"
          >
            {t('auth:continueWithGithub')}
          </Button>
          {oauthErrorKey && (
            <Alert severity="error" data-testid="login-oauth-error">
              {t(oauthErrorKey)}
            </Alert>
          )}
        </Stack>
        <Box sx={SEAM_SX} my={SEAM_GAP}>
          <Box sx={SEAM_LINE_SX} />
          <Typography variant="caption" sx={SEAM_WORD_SX}>
            {t('auth:orSeam')}
          </Typography>
          <Box sx={SEAM_LINE_SX} />
        </Box>
        <form onSubmit={handleSubmit} data-testid="login-form">
          <Stack spacing={PATH_ELEMENT_GAP} sx={FIELD_FAMILY_SX}>
            <TextField
              label={t('auth:email')}
              type="email"
              value={email}
              onChange={handleEmailChange}
              inputProps={LOGIN_EMAIL_INPUT_PROPS}
              required
            />
            <TextField
              label={t('auth:password')}
              type="password"
              value={password}
              onChange={handlePasswordChange}
              inputProps={LOGIN_PASSWORD_INPUT_PROPS}
              required
            />
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              fullWidth
              sx={CONTROL_SX}
              data-testid="login-submit"
            >
              {t('auth:signIn')}
            </Button>
            {errorKey && (
              <Alert severity="error" data-testid="login-error">
                {t(errorKey)}
              </Alert>
            )}
          </Stack>
        </form>
      </Stack>
    </Container>
  );
}
