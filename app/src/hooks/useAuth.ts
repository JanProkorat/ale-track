import type { AuthContextValue } from 'src/providers/AuthProvider';

import { useContext } from 'react';

import { AuthContext } from 'src/providers/AuthProvider';

export default function useAuth(): AuthContextValue {
     const ctx = useContext(AuthContext);
     if (!ctx) {
          throw new Error('useAuth must be used inside <AuthProvider>');
     }
     return ctx;
}
