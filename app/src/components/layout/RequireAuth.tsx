import { Navigate } from 'react-router-dom';

import useAuth from 'src/hooks/useAuth';

interface RequireAuthProps {
     children: React.ReactNode;
}

export default function RequireAuth({ children }: RequireAuthProps) {
     const { user, isAuthLoading } = useAuth();

     if (isAuthLoading) {
          return null;
     }

     if (!user) {
          return <Navigate to="/login" replace />;
     }

     return <>{children}</>;
}
