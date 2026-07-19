import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { type CurrentUser } from './types';
import { canEdit as canEditPerms, canSee as canSeePerms, type ModuleKey } from './permissions';
import { findDemoUser } from './mockUsers';

const TOKEN_KEY = 'authToken';
const REFRESH_KEY = 'refreshToken';
const USER_KEY = 'aletrack.user';

interface AuthContextValue {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  signIn: (userName: string, password: string) => Promise<void>;
  signOut: () => void;
  switchUser: (u: CurrentUser) => void;
  canSee: (m: ModuleKey) => boolean;
  canEdit: (m: ModuleKey) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStoredUser(): CurrentUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw || !localStorage.getItem(TOKEN_KEY)) return null;
    return JSON.parse(raw) as CurrentUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(loadStoredUser);

  const persist = useCallback((u: CurrentUser) => {
    // P1 mock. P3 replaces this with the real POST /login → {accessToken, refreshToken}.
    localStorage.setItem(TOKEN_KEY, `mock-access-${u.id}`);
    localStorage.setItem(REFRESH_KEY, `mock-refresh-${u.id}`);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setUser(u);
  }, []);

  const signIn = useCallback(
    async (userName: string, password: string) => {
      const found = findDemoUser(userName);
      if (!found || !password) {
        throw new Error('Nesprávné uživatelské jméno nebo heslo.');
      }
      persist(found);
    },
    [persist]
  );

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      signIn,
      signOut,
      switchUser: persist,
      canSee: (m) => (user ? canSeePerms(user.perms, m) : false),
      canEdit: (m) => (user ? canEditPerms(user.perms, m) : false),
    }),
    [user, signIn, signOut, persist]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
