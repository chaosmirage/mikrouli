import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

interface GuestNavProps {
  navigate: (to: string) => void;
}

interface AuthNavProps {
  email: string;
  onLogout: () => void;
  navigate: (to: string) => void;
}

function GuestNav({ navigate }: GuestNavProps) {
  return (
    <>
      <Button color="inherit" onClick={() => navigate('/login')} data-testid="nav-login">
        Login
      </Button>
      <Button color="inherit" onClick={() => navigate('/register')} data-testid="nav-register">
        Register
      </Button>
    </>
  );
}

function AuthNav({ email, onLogout, navigate }: AuthNavProps) {
  return (
    <>
      <Button color="inherit" onClick={() => navigate('/dashboard')} data-testid="nav-dashboard">
        Dashboard
      </Button>
      <Button color="inherit" onClick={() => navigate('/api-keys')} data-testid="nav-api-keys">
        API Keys
      </Button>
      <Typography component="span" sx={{ mx: 1 }} data-testid="nav-user-email">
        {email}
      </Typography>
      <Button color="inherit" onClick={onLogout} data-testid="nav-logout">
        Logout
      </Button>
    </>
  );
}

export default function AppShell() {
  const { user, logout } = useAuth();
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
      mikrouli
    </Typography>
  );
  return (
    <>
      <AppBar position="static" data-testid="app-bar">
        <Toolbar data-testid="nav-toolbar">
          {title}
          {navContent}
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 4 }} data-testid="page-content">
        <Outlet />
      </Container>
    </>
  );
}
