import { FormEvent, useCallback, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
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

interface RegisterFormErrors {
  email?: string;
  password?: string;
}

const PASSWORD_MIN_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTTP_CONFLICT = 409;

// Column rhythm shared with the sign-in surface (frame S3): one narrow
// centered column — 400px at the desktop register — naming at the title
// register, the shorter federated path first, a hairline "or" seam, the
// credentials path second. A zone between the column's parts, a block around
// the seam, the element step within one path.
const REGISTER_PAGE_SX = { pt: { xs: 4, sm: 3 }, pb: { xs: 4, sm: 6 } } as const;
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
const STAKE_LINE_SX = { color: 'text.secondary' } as const;
const REGISTER_EMAIL_INPUT_PROPS = { 'data-testid': 'register-email' } as const;
const REGISTER_PASSWORD_INPUT_PROPS = { 'data-testid': 'register-password' } as const;

// The seam between the two paths: two hairlines with the "or" reading between
// them, so the credentials path reads as the second path of one family, not a
// second form.
const SEAM_SX = { display: 'flex', alignItems: 'center', gap: 3 } as const;
const SEAM_LINE_SX = { flex: 1, height: '1px', bgcolor: 'divider' } as const;
const SEAM_WORD_SX = { color: 'text.disabled' } as const;

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

  return (
    <Container maxWidth="sm" sx={REGISTER_PAGE_SX} data-testid="register-page">
      <Stack sx={ENTERING_COLUMN_SX}>
        <Stack spacing={1}>
          <Typography variant="title" component="h1" sx={ENTERING_TITLE_SX}>
            {t('auth:registerTitle')}
          </Typography>
          {fromRegisterOffer && (
            <Typography variant="body2" sx={STAKE_LINE_SX} data-testid="register-kept-link">
              {t('auth:keptLinkStake')}
            </Typography>
          )}
        </Stack>
        <Stack spacing={PATH_ELEMENT_GAP} component="section" sx={{ mt: PATH_ZONE_GAP }}>
          <Button
            variant="outlined"
            onClick={loginWithGithub}
            fullWidth
            sx={CONTROL_SX}
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
        <Box sx={SEAM_SX} my={SEAM_GAP}>
          <Box sx={SEAM_LINE_SX} />
          <Typography variant="caption" sx={SEAM_WORD_SX}>
            {t('auth:orSeam')}
          </Typography>
          <Box sx={SEAM_LINE_SX} />
        </Box>
        <form onSubmit={handleSubmit} data-testid="register-form">
          <Stack spacing={PATH_ELEMENT_GAP} sx={FIELD_FAMILY_SX}>
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
              sx={CONTROL_SX}
              data-testid="register-submit"
            >
              {t('auth:registerSubmit')}
            </Button>
            {errorKey && (
              <Alert severity="error" data-testid="register-server-error">
                {t(errorKey)}
              </Alert>
            )}
          </Stack>
        </form>
      </Stack>
    </Container>
  );
}
