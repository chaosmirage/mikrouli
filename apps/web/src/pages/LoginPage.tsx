import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const HTTP_UNAUTHORIZED = 401;

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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const key = await attemptLogin(login, email, password);
    setErrorKey(key);
    setLoading(false);
    if (!key) navigate('/dashboard');
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }} data-testid="login-page">
      <form onSubmit={handleSubmit} data-testid="login-form">
        <Stack spacing={2}>
          <Typography variant="h4">{t('auth:signIn')}</Typography>
          <TextField
            label={t('auth:email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputProps={{ 'data-testid': 'login-email' }}
            required
          />
          <TextField
            label={t('auth:password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            inputProps={{ 'data-testid': 'login-password' }}
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
            onClick={() => navigate('/register')}
            data-testid="login-to-register"
          >
            {t('auth:noAccount')}
          </Button>
        </Stack>
      </form>
    </Container>
  );
}
