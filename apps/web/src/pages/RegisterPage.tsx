import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import { ApiError, extractErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';

interface RegisterFormErrors {
  email?: string;
  password?: string;
}

const PASSWORD_MIN_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTTP_CONFLICT = 409;

function validatePassword(password: string): string | undefined {
  const hasLength = password.length >= PASSWORD_MIN_LENGTH;
  const hasMixedCase = /[A-Z]/.test(password) && /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  if (!hasLength || !hasMixedCase || !hasDigit) return '≥8 chars, mixed case, digit required';
  return undefined;
}

function validateRegisterForm(email: string, password: string): RegisterFormErrors {
  const errors: RegisterFormErrors = {};
  if (!EMAIL_PATTERN.test(email)) errors.email = 'Valid email required';
  const pwError = validatePassword(password);
  if (pwError) errors.password = pwError;
  return errors;
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
    if (err instanceof ApiError && err.status === HTTP_CONFLICT) return 'Email already registered';
    return extractErrorMessage(err);
  }
}

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formErrors, setFormErrors] = useState<RegisterFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errors = validateRegisterForm(email, password);
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setLoading(true);
    const error = await attemptRegister(register, email, password);
    setServerError(error);
    setLoading(false);
    if (!error) navigate('/dashboard');
  };

  return <Container maxWidth="sm" sx={{ py: 4 }} data-testid="register-page"><form onSubmit={handleSubmit} data-testid="register-form"><Stack spacing={2}>
    <Typography variant="h4">Create account</Typography>
    <TextField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} inputProps={{ 'data-testid': 'register-email' }} required error={!!formErrors.email} helperText={formErrors.email} />
    <TextField label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} inputProps={{ 'data-testid': 'register-password' }} required error={!!formErrors.password} helperText={formErrors.password ?? '≥8 chars, mixed case, digit'} />
    <Button type="submit" variant="contained" disabled={loading} data-testid="register-submit">Register</Button>
    {serverError && <Alert severity="error" data-testid="register-server-error">{serverError}</Alert>}
    <Button variant="text" onClick={() => navigate('/login')} data-testid="register-to-login">Already have an account? Sign in</Button>
  </Stack></form></Container>;
}
