import { Navigate, Outlet } from 'react-router-dom';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from './AuthContext';

export default function ProtectedRoute() {
  const { user, bootstrapping } = useAuth();
  if (bootstrapping) return <CircularProgress data-testid="auth-bootstrapping" />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
