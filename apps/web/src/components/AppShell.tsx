import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import MenuItem from '@mui/material/MenuItem';
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
      sx={{ color: 'inherit', '& .MuiOutlinedInput-notchedOutline': { border: 'none' } }}
    >
      <MenuItem value="en" data-testid="locale-option-en">
        English
      </MenuItem>
      <MenuItem value="ru" data-testid="locale-option-ru">
        Русский
      </MenuItem>
    </Select>
  );
}

function GuestNav({ navigate }: GuestNavProps) {
  const { t } = useTranslation('common');
  return (
    <>
      <Button color="inherit" onClick={() => navigate('/login')} data-testid="nav-login">
        {t('login')}
      </Button>
      <Button color="inherit" onClick={() => navigate('/register')} data-testid="nav-register">
        {t('register')}
      </Button>
    </>
  );
}

function AuthNav({ email, onLogout, navigate }: AuthNavProps) {
  const { t } = useTranslation('common');
  return (
    <>
      <Button color="inherit" onClick={() => navigate('/dashboard')} data-testid="nav-dashboard">
        {t('dashboard')}
      </Button>
      <Button color="inherit" onClick={() => navigate('/api-keys')} data-testid="nav-api-keys">
        {t('apiKeys')}
      </Button>
      <Typography component="span" sx={{ mx: 1 }} data-testid="nav-user-email">
        {email}
      </Typography>
      <Button color="inherit" onClick={onLogout} data-testid="nav-logout">
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
      sx={{ flexGrow: 1, cursor: 'pointer' }}
      onClick={() => navigate('/')}
      data-testid="nav-title"
    >
      {t('appName')}
    </Typography>
  );
  return (
    <>
      <AppBar position="static" data-testid="app-bar">
        <Toolbar data-testid="nav-toolbar">
          {title}
          {navContent}
          <LocaleSwitcher />
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 4 }} data-testid="page-content">
        <Outlet />
      </Container>
    </>
  );
}
