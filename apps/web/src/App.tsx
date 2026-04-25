import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import AppShell from './components/AppShell';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import StatsPage from './pages/StatsPage';
import ApiKeysPage from './pages/ApiKeysPage';

export default function App() {
  const protectedRoutes = <Route element={<ProtectedRoute />}>
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="/stats/:slug" element={<StatsPage />} />
    <Route path="/api-keys" element={<ApiKeysPage />} />
  </Route>;
  const shell = <AuthProvider><AppShell /></AuthProvider>;
  const outerRoute = <Route element={shell}>
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    {protectedRoutes}
  </Route>;
  return <Routes>{outerRoute}</Routes>;
}
