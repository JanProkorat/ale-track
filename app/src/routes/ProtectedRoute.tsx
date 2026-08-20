import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from 'src/auth/AuthProvider';
import { LOGIN_PATH } from './paths';

export function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to={LOGIN_PATH} replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
