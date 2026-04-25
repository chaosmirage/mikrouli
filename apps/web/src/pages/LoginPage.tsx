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

const HTTP_UNAUTHORIZED = 401;

async function attemptLogin(
  login: (email: string, password: string) => Promise<void>,
  email: string,
  password: string,
): Promise<string | null> {
  try {
    await login(email, password);
    return null;
  } catch (err) {
    if (err instanceof ApiError && err.status === HTTP_UNAUTHORIZED)
      return 'Invalid email or password';
    return extractErrorMessage(err);
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const error = await attemptLogin(login, email, password);
    setServerError(error);
    setLoading(false);
    if (!error) navigate('/dashboard');
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }} data-testid="login-page">
      <form onSubmit={handleSubmit} data-testid="login-form">
        <Stack spacing={2}>
          <Typography variant="h4">Sign in</Typography>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputProps={{ 'data-testid': 'login-email' }}
            required
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            inputProps={{ 'data-testid': 'login-password' }}
            required
          />
          <Button type="submit" variant="contained" disabled={loading} data-testid="login-submit">
            Sign in
          </Button>
          {serverError && (
            <Alert severity="error" data-testid="login-error">
              {serverError}
            </Alert>
          )}
          <Button
            variant="text"
            onClick={() => navigate('/register')}
            data-testid="login-to-register"
          >
            Don't have an account? Register
          </Button>
        </Stack>
      </form>
    </Container>
  );
}
