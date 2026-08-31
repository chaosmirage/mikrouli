import { useCallback, useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Link from '@mui/material/Link';
import MenuIcon from '@mui/icons-material/Menu';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import LanguageIcon from '@mui/icons-material/Language';
import {Outlet, useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import SettingsPanel from './SettingsPanel';

const NAV_BUTTON_SX = { color: 'text.primary' } as const;

const NAV_TITLE_SX = { cursor: 'pointer', fontWeight: 700, color: 'text.primary' } as const;

const TOOLBAR_SX = { gap: 1.5 } as const;

const FLEX_GROW_SX = { flexGrow: 1 } as const;

const USER_EMAIL_SX = { color: 'text.secondary', fontSize: '0.875rem', mx: 1 } as const;

const MENU_EMAIL_SX = { color: 'text.secondary', fontSize: '0.875rem' } as const;

const MENU_BUTTON_SX = { display: { xs: 'inline-flex', md: 'none' } } as const;

const DESKTOP_NAV_SX = { display: { xs: 'none', md: 'flex' } } as const;

const SETTINGS_REACH_SX = { color: 'text.secondary' } as const;

const FOOTER_SX = {
  py: 2,
  px: 2,
  mt: 'auto',
  bgcolor: 'background.paper',
  borderTop: '1px solid',
  borderColor: 'divider',
} as const;

const FOOTER_LINK_SX = { color: 'text.secondary', fontSize: '0.875rem' } as const;

const SHELL_SX = { display: 'flex', flexDirection: 'column', minHeight: '100vh' } as const;

const MAIN_SX = { flex: '1 0 auto' } as const;

// A single nav action rendered as BOTH a desktop inline Button (carrying the
// testId) and a mobile MenuItem (without testId). Both surfaces draw from the
// same array so exactly ONE auth-state branch produces all nav content.
interface NavAction {
  label: string;
  testId?: string;
  onClick: () => void;
  variant?: 'text' | 'contained' | 'outlined';
  color?: 'inherit' | 'primary';
  sx?: typeof NAV_BUTTON_SX;
}

// Presentation helper: closes the overflow Menu then fires the action. Using a
// dedicated component with useCallback avoids react/jsx-no-bind inside .map().
function NavMenuItem({
  label,
  onActivate,
  onClose,
}: {
  label: string;
  onActivate: () => void;
  onClose: () => void;
}) {
  const handleClick = useCallback(() => {
    onClose();
    onActivate();
  }, [onClose, onActivate]);
  return <MenuItem onClick={handleClick}>{label}</MenuItem>;
}

function Footer() {
  const { t } = useTranslation('common');
  return (
    <Box component="footer" data-testid="footer" sx={FOOTER_SX}>
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
  const pathname = useLocation().pathname;

  const handleLogin = useCallback(() => navigate('/login'), [navigate]);
  const handleRegister = useCallback(() => navigate('/register'), [navigate]);
  const handleDashboard = useCallback(() => navigate('/dashboard'), [navigate]);
  const handleApiKeys = useCallback(() => navigate('/api-keys'), [navigate]);
  const handleUsage = useCallback(() => navigate('/usage'), [navigate]);
  const handleHome = useCallback(() => navigate('/'), [navigate]);

  // The setting pair stands over whatever place the user occupies: the open
  // flag lives here (the only reader/writer), and closing it never navigates.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const menuOpen = Boolean(menuAnchorEl);

  const handleOpenMenu = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setMenuAnchorEl(event.currentTarget);
  }, []);
  const handleCloseMenu = useCallback(() => {
    setMenuAnchorEl(null);
  }, []);

  // SINGLE auth-state branch: ONE `user ?` ternary produces ALL nav actions.
  // Both the desktop inline Buttons and the mobile Menu MenuItems render from
  // this array, eliminating any second auth-state branch that could diverge.
  const navActions: NavAction[] = user
    ? [
        { label: t('dashboard'), testId: 'nav-dashboard', onClick: handleDashboard, sx: NAV_BUTTON_SX },
        { label: t('apiKeys'), testId: 'nav-api-keys', onClick: handleApiKeys, sx: NAV_BUTTON_SX },
        { label: t('usage'), testId: 'nav-usage', onClick: handleUsage, sx: NAV_BUTTON_SX },
        {
          label: t('logout'),
          testId: 'nav-logout',
          onClick: logout,
          variant: 'outlined',
          sx: NAV_BUTTON_SX,
        },
      ]
    : [
        { label: t('login'), testId: 'nav-login', onClick: handleLogin, sx: NAV_BUTTON_SX },
        {
          label: t('register'),
          testId: 'nav-register',
          onClick: handleRegister,
          color: 'primary',
        },
      ];

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
    <Box sx={SHELL_SX}>
      <AppBar position="static" data-testid="app-bar">
        <Toolbar data-testid="nav-toolbar" sx={TOOLBAR_SX}>
          {title}
          <Box sx={FLEX_GROW_SX} />
          <Stack direction="row" alignItems="center" spacing={1.5} data-testid="nav-actions">
            <IconButton
              data-testid="nav-menu-button"
              aria-label={t('menu')}
              onClick={handleOpenMenu}
              sx={MENU_BUTTON_SX}
            >
              <MenuIcon />
            </IconButton>
            <Menu anchorEl={menuAnchorEl} open={menuOpen} onClose={handleCloseMenu}>
              {user && (
                <MenuItem disabled>
                  <Typography component="span" sx={MENU_EMAIL_SX}>
                    {user.email}
                  </Typography>
                </MenuItem>
              )}
              {navActions.map((action) => (
                <NavMenuItem
                  key={action.label}
                  label={action.label}
                  onActivate={action.onClick}
                  onClose={handleCloseMenu}
                />
              ))}
            </Menu>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={DESKTOP_NAV_SX}>
              {navActions.map((action) => (
                <Button
                  key={action.label}
                  onClick={action.onClick}
                  variant={action.variant}
                  color={action.color}
                  data-testid={action.testId}
                  sx={action.sx}
                >
                  {action.label}
                </Button>
              ))}
              {user && (
                <Typography component="span" data-testid="nav-user-email" sx={USER_EMAIL_SX}>
                  {user.email}
                </Typography>
              )}
            </Stack>
            <IconButton
              data-testid="settings-mode-reach"
              aria-label={t('themeMode')}
              onClick={openSettings}
              sx={SETTINGS_REACH_SX}
            >
              <PaletteOutlinedIcon />
            </IconButton>
            <IconButton
              data-testid="settings-language-reach"
              aria-label={t('language')}
              onClick={openSettings}
              sx={SETTINGS_REACH_SX}
            >
              <LanguageIcon />
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>
      <Box component="main" data-testid="page-content" sx={MAIN_SX}>
        <Outlet />
      </Box>
      {pathname !== '/' && <Footer />}
      <SettingsPanel open={settingsOpen} onClose={closeSettings} />
    </Box>
  );
}
