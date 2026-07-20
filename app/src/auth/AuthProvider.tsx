import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { type CurrentUser } from './types';
import { canEdit as canEditPerms, canSee as canSeePerms, type ModuleKey } from './permissions';
import { userFromToken, isTokenExpired } from './jwt';
import { useQueryClient } from '@tanstack/react-query';
import { LoginUserDto } from 'src/generated/api-client';
import { api } from 'src/api/apiClient';
import { setApiTokens, setAuthFailedHandler, setTokensRefreshedHandler } from 'src/api/apiClient';
import { apiErrorMessage } from 'src/api/errors';

const TOKEN_KEY = 'authToken';
const REFRESH_KEY = 'refreshToken';
const USER_KEY = 'aletrack.user';

interface AuthContextValue {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  /** Real login against the backend. */
  signIn: (userName: string, password: string) => Promise<void>;
  signOut: () => void;
  canSee: (m: ModuleKey) => boolean;
  canEdit: (m: ModuleKey) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function persist(u: CurrentUser, access: string, refresh: string) {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
  localStorage.setItem(USER_KEY, JSON.stringify(u));
}
function clearStorage() {
  [TOKEN_KEY, REFRESH_KEY, USER_KEY].forEach((k) => localStorage.removeItem(k));
}

function restore(): CurrentUser | null {
  try {
    const access = localStorage.getItem(TOKEN_KEY);
    const refresh = localStorage.getItem(REFRESH_KEY);
    if (access && refresh && !isTokenExpired(access)) {
      setApiTokens(access, refresh);
      return userFromToken(access);
    }
    clearStorage();
  } catch {
    clearStorage();
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(restore);
  const qc = useQueryClient();

  const signOut = useCallback(() => {
    clearStorage();
    setApiTokens(null, null);
    qc.clear();
    setUser(null);
  }, [qc]);

  // Keep the api layer's refresh/failure handlers pointed at this provider.
  useEffect(() => {
    setAuthFailedHandler(() => signOut());
    setTokensRefreshedHandler((access, refresh) => {
      localStorage.setItem(TOKEN_KEY, access);
      localStorage.setItem(REFRESH_KEY, refresh);
    });
    return () => {
      setAuthFailedHandler(null);
      setTokensRefreshedHandler(null);
    };
  }, [signOut]);

  const signIn = useCallback(async (userName: string, password: string) => {
    let res;
    try {
      res = await api.loginEndpoint(new LoginUserDto({ userName, password }));
    } catch (e) {
      throw new Error(apiErrorMessage(e, 'Nesprávné uživatelské jméno nebo heslo.'));
    }
    const access = res.accessToken;
    const refresh = res.refreshToken;
    if (!access || !refresh) throw new Error('Server nevrátil přihlašovací token.');
    const u = userFromToken(access);
    if (!u) throw new Error('Neplatný přihlašovací token.');
    setApiTokens(access, refresh);
    persist(u, access, refresh);
    qc.clear();
    setUser(u);
  }, [qc]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      signIn,
      signOut,
      canSee: (m) => (user ? canSeePerms(user.perms, m) : false),
      canEdit: (m) => (user ? canEditPerms(user.perms, m) : false),
    }),
    [user, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
