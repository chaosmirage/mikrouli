import { useCallback } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import Link from '@mui/material/Link';
import { Outlet, useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import ThemeModeSwitch from './ThemeModeSwitch';

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

const FOOTER_SX = {
  py: 2,
  px: 2,
  mt: 'auto',
  bgcolor: 'background.paper',
  borderTop: '1px solid',
  borderColor: 'divider',
} as const;

const FOOTER_STICKY_SX = { position: 'sticky', bottom: 0 } as const;

const FOOTER_LINK_SX = { color: 'text.secondary', fontSize: '0.875rem' } as const;

interface GuestNavProps {
  onLogin: () => void;
  onRegister: () => void;
}

interface AuthNavProps {
  email: string;
  onLogout: () => void;
  onDashboard: () => void;
  onApiKeys: () => void;
  onUsage: () => void;
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

function AuthNav({ email, onLogout, onDashboard, onApiKeys, onUsage }: AuthNavProps) {
  const { t } = useTranslation('common');
  return (
    <>
      <Button onClick={onDashboard} data-testid="nav-dashboard" sx={NAV_BUTTON_SX}>
        {t('dashboard')}
      </Button>
      <Button onClick={onApiKeys} data-testid="nav-api-keys" sx={NAV_BUTTON_SX}>
        {t('apiKeys')}
      </Button>
      <Button onClick={onUsage} data-testid="nav-usage" sx={NAV_BUTTON_SX}>
        {t('usage')}
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

function Footer({ sticky }: { sticky: boolean }) {
  const { t } = useTranslation('common');
  return (
    <Box component="footer" data-testid="footer" sx={{ ...FOOTER_SX, ...(sticky ? FOOTER_STICKY_SX : {}) }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 1, sm: 2 }}
        alignItems="center"
        justifyContent="center"
      >
        <Link component={RouterLink} to="/terms" data-testid="footer-terms" sx={FOOTER_LINK_SX}>
          {t('terms')}
        </Link>
        <Link component={RouterLink} to="/privacy" data-testid="footer-privacy" sx={FOOTER_LINK_SX}>
          {t('privacy')}
        </Link>
        <Link href="mailto:support@mikrou.li" data-testid="footer-contact" sx={FOOTER_LINK_SX}>
          {t('contact')}
        </Link>
      </Stack>
    </Box>
  );
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const footerSticky = !isLanding;

  const handleLogin = useCallback(() => navigate('/login'), [navigate]);
  const handleRegister = useCallback(() => navigate('/register'), [navigate]);
  const handleDashboard = useCallback(() => navigate('/dashboard'), [navigate]);
  const handleApiKeys = useCallback(() => navigate('/api-keys'), [navigate]);
  const handleUsage = useCallback(() => navigate('/usage'), [navigate]);
  const handleHome = useCallback(() => navigate('/'), [navigate]);

  const navContent = user ? (
    <AuthNav
      email={user.email}
      onLogout={logout}
      onDashboard={handleDashboard}
      onApiKeys={handleApiKeys}
      onUsage={handleUsage}
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
            <ThemeModeSwitch />
            <LocaleSwitcher />
          </Stack>
        </Toolbar>
      </AppBar>
      <Box component="main" data-testid="page-content">
        <Outlet />
      </Box>
      <Footer sticky={footerSticky} />
    </>
  );
}
