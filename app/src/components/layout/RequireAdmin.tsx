import { Navigate } from 'react-router-dom';

import useAuth from 'src/hooks/useAuth';

interface RequireAdminProps {
     children: React.ReactNode;
}

export default function RequireAdmin({ children }: RequireAdminProps) {
     const { user, isAdmin } = useAuth();

     if (!user) {
          return <Navigate to="/login" replace />;
     }

     if (!isAdmin) {
          return <Navigate to="/" replace />;
     }

     return <>{children}</>;
}
