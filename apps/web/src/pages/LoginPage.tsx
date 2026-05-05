import { FormEvent, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const HTTP_UNAUTHORIZED = 401;

const LOGIN_PAGE_SX = { py: 6 } as const;
const LOGIN_PAPER_SX = { p: { xs: 3, sm: 4 } } as const;
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
  const { login } = useAuth();
  const navigate = useNavigate();

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
      <Paper variant="outlined" sx={LOGIN_PAPER_SX}>
        <form onSubmit={handleSubmit} data-testid="login-form">
          <Stack spacing={2}>
          <Typography variant="h4">{t('auth:signIn')}</Typography>
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
          <Button type="submit" variant="contained" disabled={loading} data-testid="login-submit">
            {t('auth:signIn')}
          </Button>
          {errorKey && (
            <Alert severity="error" data-testid="login-error">
              {t(errorKey)}
            </Alert>
          )}
          <Button
            variant="text"
            onClick={handleGoRegister}
            data-testid="login-to-register"
          >
            {t('auth:noAccount')}
          </Button>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}
