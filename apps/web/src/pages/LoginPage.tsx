import { FormEvent, useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { resolveOauthErrorKey } from './oauth-error';

const HTTP_UNAUTHORIZED = 401;

// Column rhythm: the entering is one narrow centered column (the least
// entering it admits is also the least surface it admits), so the statement
// stands directly on the canvas with the two paths staged as two coherent
// groups below it — the shorter federated path first, the credentials path
// second. Gap ordering: block-level between the column's parts, element-level
// within one path (theme spacing steps).
const LOGIN_PAGE_SX = { py: { xs: 4, sm: 6 } } as const;
const PATH_ELEMENT_GAP = 2;
const PATH_BLOCK_GAP = 3;
const LOGIN_EMAIL_INPUT_PROPS = { 'data-testid': 'login-email' } as const;
const LOGIN_PASSWORD_INPUT_PROPS = { 'data-testid': 'login-password' } as const;

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
  const handleGoRegister = useCallback(() => navigate('/register'), [navigate]);

  return (
    <Container maxWidth="sm" sx={LOGIN_PAGE_SX} data-testid="login-page">
      <Stack spacing={PATH_BLOCK_GAP}>
        <Typography variant="h4" component="h1">
          {t('auth:signIn')}
        </Typography>
        <Stack spacing={PATH_ELEMENT_GAP} component="section">
          <Button
            variant="outlined"
            onClick={loginWithGithub}
            fullWidth
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
        <Divider />
        <form onSubmit={handleSubmit} data-testid="login-form">
          <Stack spacing={PATH_ELEMENT_GAP}>
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
        <Button variant="text" onClick={handleGoRegister} data-testid="login-to-register">
          {t('auth:noAccount')}
        </Button>
      </Stack>
    </Container>
  );
}
