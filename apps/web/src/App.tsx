import { Outlet, Route, Routes } from 'react-router-dom';
import Container from '@mui/material/Container';
import { AuthProvider } from './auth/AuthContext';
import GuestRoute from './auth/GuestRoute';
import ProtectedRoute from './auth/ProtectedRoute';
import AppShell from './components/AppShell';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import StatsPage from './pages/StatsPage';
import ApiKeysPage from './pages/ApiKeysPage';

// Inner layout for content pages — wraps the outlet in a centred Container.
// Landing page deliberately renders outside this layout so its hero/feature/
// bottom-cta sections can occupy full viewport width with alternating backgrounds.
function ContainedLayout() {
  return (
    <Container maxWidth="lg" sx={{ py: 5 }} data-testid="contained-layout">
      <Outlet />
    </Container>
  );
}

export default function App() {
  const guestRoutes = (
    <Route element={<GuestRoute />}>
      <Route path="/" element={<LandingPage />} />
      <Route element={<ContainedLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
    </Route>
  );
  const protectedRoutes = (
    <Route element={<ProtectedRoute />}>
      <Route element={<ContainedLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/stats/:slug" element={<StatsPage />} />
        <Route path="/api-keys" element={<ApiKeysPage />} />
      </Route>
    </Route>
  );
  const shell = (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
  const outerRoute = (
    <Route element={shell}>
      {guestRoutes}
      {protectedRoutes}
    </Route>
  );
  return <Routes>{outerRoute}</Routes>;
}
