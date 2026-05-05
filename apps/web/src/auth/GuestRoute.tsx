import { Navigate, Outlet } from 'react-router-dom';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from './AuthContext';

// Mirror of ProtectedRoute: when the visitor IS authenticated, the public
// landing / sign-in / register pages should bounce them straight to the
// dashboard. When NOT authenticated, render the children (Outlet).
export default function GuestRoute() {
  const { user, bootstrapping } = useAuth();
  if (bootstrapping) return <CircularProgress data-testid="auth-bootstrapping" />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
