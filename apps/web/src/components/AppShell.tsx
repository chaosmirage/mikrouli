import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import { Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';

interface GuestNavProps {
  navigate: (to: string) => void;
}

interface AuthNavProps {
  email: string;
  onLogout: () => void;
  navigate: (to: string) => void;
}

function LocaleSwitcher() {
  const { i18n, t } = useTranslation('common');
  const handleChange = (e: SelectChangeEvent) => {
    void i18n.changeLanguage(e.target.value);
  };
  return (
    <Select
      value={i18n.resolvedLanguage ?? i18n.language}
      onChange={handleChange}
      size="small"
      data-testid="locale-switcher"
      inputProps={{ 'aria-label': t('language') }}
      sx={{
        color: 'text.secondary',
        fontSize: '0.875rem',
        '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
      }}
    >
      <MenuItem value="en" data-testid="locale-option-en">
        English
      </MenuItem>
      <MenuItem value="de" data-testid="locale-option-de">
        Deutsch
      </MenuItem>
    </Select>
  );
}

function GuestNav({ navigate }: GuestNavProps) {
  const { t } = useTranslation('common');
  return (
    <>
      <Button
        onClick={() => navigate('/login')}
        data-testid="nav-login"
        sx={{ color: 'text.primary' }}
      >
        {t('login')}
      </Button>
      <Button
        variant="contained"
        color="primary"
        onClick={() => navigate('/register')}
        data-testid="nav-register"
      >
        {t('register')}
      </Button>
    </>
  );
}

function AuthNav({ email, onLogout, navigate }: AuthNavProps) {
  const { t } = useTranslation('common');
  return (
    <>
      <Button
        onClick={() => navigate('/dashboard')}
        data-testid="nav-dashboard"
        sx={{ color: 'text.primary' }}
      >
        {t('dashboard')}
      </Button>
      <Button
        onClick={() => navigate('/api-keys')}
        data-testid="nav-api-keys"
        sx={{ color: 'text.primary' }}
      >
        {t('apiKeys')}
      </Button>
      <Typography
        component="span"
        data-testid="nav-user-email"
        sx={{ color: 'text.secondary', fontSize: '0.875rem', mx: 1 }}
      >
        {email}
      </Typography>
      <Button
        variant="outlined"
        onClick={onLogout}
        data-testid="nav-logout"
        sx={{ color: 'text.primary' }}
      >
        {t('logout')}
      </Button>
    </>
  );
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const navContent = user ? (
    <AuthNav email={user.email} onLogout={logout} navigate={navigate} />
  ) : (
    <GuestNav navigate={navigate} />
  );
  const title = (
    <Typography
      variant="h6"
      component="span"
      onClick={() => navigate('/')}
      data-testid="nav-title"
      sx={{ cursor: 'pointer', fontWeight: 700, color: 'text.primary' }}
    >
      {t('appName')}
    </Typography>
  );
  return (
    <>
      <AppBar position="static" data-testid="app-bar">
        <Toolbar data-testid="nav-toolbar" sx={{ gap: 1.5 }}>
          {title}
          <Box sx={{ flexGrow: 1 }} />
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {navContent}
            <LocaleSwitcher />
          </Stack>
        </Toolbar>
      </AppBar>
      <Container maxWidth="md" sx={{ py: 5 }} data-testid="page-content">
        <Outlet />
      </Container>
    </>
  );
}
