/* eslint-disable react-refresh/only-export-components */
import { Outlet, Route, Routes } from 'react-router-dom';
import Container from '@mui/material/Container';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
import ConnectPage from './pages/ConnectPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import UsagePage from './pages/UsagePage';
import { SPACE } from './theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Contained pages sit inside the reading measure with the page's own margin
// rhythm — a wider viewport buys margins and calm, never longer lines.
const CONTAINED_LAYOUT_SX = { py: SPACE.page, maxWidth: `${SPACE.measure}px`, mx: 'auto' };

// Inner layout for content pages — wraps the outlet in a centred Container.
// Landing page deliberately renders outside this layout: its composition —
// statement, act, claims — is the one full-viewport reading, bounding its own
// reading columns instead of the contained measure.
function ContainedLayout() {
  return (
    <Container maxWidth={false} sx={CONTAINED_LAYOUT_SX} data-testid="contained-layout">
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
        <Route path="/usage" element={<UsagePage />} />
      </Route>
    </Route>
  );
  const shell = (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </QueryClientProvider>
  );
  const publicRoutes = (
    <>
      <Route path="/connect" element={<ConnectPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
    </>
  );
  const outerRoute = (
    <Route element={shell}>
      {publicRoutes}
      {guestRoutes}
      {protectedRoutes}
    </Route>
  );
  return <Routes>{outerRoute}</Routes>;
}

export { queryClient };
