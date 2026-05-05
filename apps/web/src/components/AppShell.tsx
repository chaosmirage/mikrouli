import { useCallback } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import { Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';

const LOCALE_SELECT_SX = {
  color: 'text.secondary',
  fontSize: '0.875rem',
  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
} as const;

const NAV_BUTTON_SX = { color: 'text.primary' } as const;

const NAV_TITLE_SX = { cursor: 'pointer', fontWeight: 700, color: 'text.primary' } as const;

const TOOLBAR_SX = { gap: 1.5 } as const;

const FLEX_GROW_SX = { flexGrow: 1 } as const;

const USER_EMAIL_SX = { color: 'text.secondary', fontSize: '0.875rem', mx: 1 } as const;

interface GuestNavProps {
  onLogin: () => void;
  onRegister: () => void;
}

interface AuthNavProps {
  email: string;
  onLogout: () => void;
  onDashboard: () => void;
  onApiKeys: () => void;
}

function LocaleSwitcher() {
  const { i18n, t } = useTranslation('common');
  const handleChange = useCallback(
    (e: SelectChangeEvent) => {
      void i18n.changeLanguage(e.target.value);
    },
    [i18n],
  );
  const localeSelectInputProps = { 'aria-label': t('language') };
  return (
    <Select
      value={i18n.resolvedLanguage ?? i18n.language}
      onChange={handleChange}
      size="small"
      data-testid="locale-switcher"
      inputProps={localeSelectInputProps}
      sx={LOCALE_SELECT_SX}
    >
      <MenuItem value="en" data-testid="locale-option-en">
        English
      </MenuItem>
      <MenuItem value="de" data-testid="locale-option-de">
        Deutsch
      </MenuItem>
      <MenuItem value="el" data-testid="locale-option-el">
        Ελληνικά
      </MenuItem>
    </Select>
  );
}

function GuestNav({ onLogin, onRegister }: GuestNavProps) {
  const { t } = useTranslation('common');
  return (
    <>
      <Button onClick={onLogin} data-testid="nav-login" sx={NAV_BUTTON_SX}>
        {t('login')}
      </Button>
      <Button
        variant="contained"
        color="primary"
        onClick={onRegister}
        data-testid="nav-register"
      >
        {t('register')}
      </Button>
    </>
  );
}

function AuthNav({ email, onLogout, onDashboard, onApiKeys }: AuthNavProps) {
  const { t } = useTranslation('common');
  return (
    <>
      <Button onClick={onDashboard} data-testid="nav-dashboard" sx={NAV_BUTTON_SX}>
        {t('dashboard')}
      </Button>
      <Button onClick={onApiKeys} data-testid="nav-api-keys" sx={NAV_BUTTON_SX}>
        {t('apiKeys')}
      </Button>
      <Typography component="span" data-testid="nav-user-email" sx={USER_EMAIL_SX}>
        {email}
      </Typography>
      <Button variant="outlined" onClick={onLogout} data-testid="nav-logout" sx={NAV_BUTTON_SX}>
        {t('logout')}
      </Button>
    </>
  );
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  const handleLogin = useCallback(() => navigate('/login'), [navigate]);
  const handleRegister = useCallback(() => navigate('/register'), [navigate]);
  const handleDashboard = useCallback(() => navigate('/dashboard'), [navigate]);
  const handleApiKeys = useCallback(() => navigate('/api-keys'), [navigate]);
  const handleHome = useCallback(() => navigate('/'), [navigate]);

  const navContent = user ? (
    <AuthNav
      email={user.email}
      onLogout={logout}
      onDashboard={handleDashboard}
      onApiKeys={handleApiKeys}
    />
  ) : (
    <GuestNav onLogin={handleLogin} onRegister={handleRegister} />
  );
  const title = (
    <Typography
      variant="h6"
      component="span"
      onClick={handleHome}
      data-testid="nav-title"
      sx={NAV_TITLE_SX}
    >
      {t('appName')}
    </Typography>
  );
  return (
    <>
      <AppBar position="static" data-testid="app-bar">
        <Toolbar data-testid="nav-toolbar" sx={TOOLBAR_SX}>
          {title}
          <Box sx={FLEX_GROW_SX} />
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {navContent}
            <LocaleSwitcher />
          </Stack>
        </Toolbar>
      </AppBar>
      <Box component="main" data-testid="page-content">
        <Outlet />
      </Box>
    </>
  );
}
