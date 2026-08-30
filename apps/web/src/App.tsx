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
import NotFoundPage from './pages/NotFoundPage';
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

// Contained pages sit in the wide content zone with the page's own margin
// rhythm — the dashboard set is a scanning zone, so the shared column is the
// content token, not the reading measure; sustained reading bounds itself
// (the legal columns' own measure, the connect form's own sm column). The
// horizontal padding keeps the column off the viewport edges below the cap,
// growing with the ladder once the viewport allows.
const CONTAINED_LAYOUT_SX = {
  py: SPACE.page,
  px: { xs: SPACE.element, sm: SPACE.block },
  maxWidth: `${SPACE.content}px`,
  mx: 'auto',
};

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
      {/* The terminal catch: an address no route answers still gets the shell
          with the resolved not-found statement inside it, so navigation
          survives and the document is never blank. It stays outside the
          guest/protected groups so it renders for every visitor. */}
      <Route path="*" element={<NotFoundPage />} />
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
