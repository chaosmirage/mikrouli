import { FormEvent, useCallback, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
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

interface RegisterFormErrors {
  email?: string;
  password?: string;
}

const PASSWORD_MIN_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTTP_CONFLICT = 409;

// Column rhythm shared with the sign-in surface: one narrow centered column,
// statement on the canvas, the shorter federated path staged first and the
// credentials path second, block-level gaps between the column's parts and
// element-level gaps within one path (theme spacing steps).
const REGISTER_PAGE_SX = { py: { xs: 4, sm: 6 } } as const;
const PATH_ELEMENT_GAP = 2;
const PATH_BLOCK_GAP = 3;
const STAKE_LINE_SX = { color: 'text.secondary' } as const;
const REGISTER_EMAIL_INPUT_PROPS = { 'data-testid': 'register-email' } as const;
const REGISTER_PASSWORD_INPUT_PROPS = { 'data-testid': 'register-password' } as const;

// The register offer's accept reach opens this surface with the keeping of
// the just-made link as the understood stake; the router carries that arrival
// so the statement can restate the stake in one line. Direct arrivals (from
// the shell reach) carry no state and see no stake line.
interface RegisterArrivalState {
  fromRegisterOffer?: boolean;
}

function readArrivalState(state: unknown): RegisterArrivalState {
  if (state && typeof state === 'object') return state as RegisterArrivalState;
  return {};
}

function validatePassword(password: string): string | undefined {
  const hasLength = password.length >= PASSWORD_MIN_LENGTH;
  const hasMixedCase = /[A-Z]/.test(password) && /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  if (!hasLength || !hasMixedCase || !hasDigit) return 'auth:passwordValidationError';
  return undefined;
}

function validateRegisterForm(email: string, password: string): RegisterFormErrors {
  const errors: RegisterFormErrors = {};
  if (!EMAIL_PATTERN.test(email)) errors.email = 'auth:invalidEmail';
  const pwError = validatePassword(password);
  if (pwError) errors.password = pwError;
  return errors;
}

function mapRegisterError(err: unknown): string {
  if (err instanceof ApiError && err.status === HTTP_CONFLICT)
    return 'errors:emailAlreadyRegistered';
  return 'errors:generic';
}

async function attemptRegister(
  register: (email: string, password: string) => Promise<void>,
  email: string,
  password: string,
): Promise<string | null> {
  try {
    await register(email, password);
    return null;
  } catch (err) {
    return mapRegisterError(err);
  }
}

export default function RegisterPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formErrors, setFormErrors] = useState<RegisterFormErrors>({});
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { register, loginWithGithub } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Both derived once per render: the OAuth return slug resolves through the
  // shared closed dictionary, and the arrival state decides the stake line.
  const oauthErrorKey = resolveOauthErrorKey(searchParams.get('error'));
  const fromRegisterOffer = readArrivalState(location.state).fromRegisterOffer === true;

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const errors = validateRegisterForm(email, password);
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }
      setLoading(true);
      const key = await attemptRegister(register, email, password);
      setErrorKey(key);
      setLoading(false);
      if (!key) navigate('/dashboard');
    },
    [email, password, register, navigate],
  );

  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value),
    [],
  );
  const handlePasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value),
    [],
  );
  const handleGoLogin = useCallback(() => navigate('/login'), [navigate]);

  return (
    <Container maxWidth="sm" sx={REGISTER_PAGE_SX} data-testid="register-page">
      <Stack spacing={PATH_BLOCK_GAP}>
        <Stack spacing={1}>
          <Typography variant="h4" component="h1">
            {t('auth:register')}
          </Typography>
          {fromRegisterOffer && (
            <Typography variant="body2" sx={STAKE_LINE_SX} data-testid="register-kept-link">
              {t('auth:keptLinkStake')}
            </Typography>
          )}
        </Stack>
        <Stack spacing={PATH_ELEMENT_GAP} component="section">
          <Button
            variant="outlined"
            onClick={loginWithGithub}
            fullWidth
            data-testid="register-github"
          >
            {t('auth:continueWithGithub')}
          </Button>
          {oauthErrorKey && (
            <Alert severity="error" data-testid="register-oauth-error">
              {t(oauthErrorKey)}
            </Alert>
          )}
        </Stack>
        <Divider />
        <form onSubmit={handleSubmit} data-testid="register-form">
          <Stack spacing={PATH_ELEMENT_GAP}>
            <TextField
              label={t('auth:email')}
              type="email"
              value={email}
              onChange={handleEmailChange}
              inputProps={REGISTER_EMAIL_INPUT_PROPS}
              required
              error={!!formErrors.email}
              helperText={formErrors.email ? t(formErrors.email) : undefined}
            />
            <TextField
              label={t('auth:password')}
              type="password"
              value={password}
              onChange={handlePasswordChange}
              inputProps={REGISTER_PASSWORD_INPUT_PROPS}
              required
              error={!!formErrors.password}
              helperText={
                formErrors.password ? t(formErrors.password) : t('auth:passwordHint')
              }
            />
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              fullWidth
              data-testid="register-submit"
            >
              {t('auth:register')}
            </Button>
            {errorKey && (
              <Alert severity="error" data-testid="register-server-error">
                {t(errorKey)}
              </Alert>
            )}
          </Stack>
        </form>
        <Button variant="text" onClick={handleGoLogin} data-testid="register-to-login">
          {t('auth:hasAccount')}
        </Button>
      </Stack>
    </Container>
  );
}
