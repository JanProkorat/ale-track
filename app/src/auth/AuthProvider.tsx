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
const KEYS = [TOKEN_KEY, REFRESH_KEY, USER_KEY];

// Which Web Storage the current session lives in. "Remember me" persists to
// localStorage (survives browser restarts); unchecked uses sessionStorage
// (cleared when the tab/window closes). Tracked so token refreshes write back
// to the same store the session was started in.
let activeStore: Storage = localStorage;

interface AuthContextValue {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  /** Real login against the backend. `remember` persists the session across
   * browser restarts (localStorage) vs. only for the tab session (sessionStorage). */
  signIn: (userName: string, password: string, remember?: boolean) => Promise<void>;
  signOut: () => void;
  canSee: (m: ModuleKey) => boolean;
  canEdit: (m: ModuleKey) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function persist(u: CurrentUser, access: string, refresh: string, remember: boolean) {
  activeStore = remember ? localStorage : sessionStorage;
  // Never leave a copy behind in the other store.
  const other = remember ? sessionStorage : localStorage;
  KEYS.forEach((k) => other.removeItem(k));
  activeStore.setItem(TOKEN_KEY, access);
  activeStore.setItem(REFRESH_KEY, refresh);
  activeStore.setItem(USER_KEY, JSON.stringify(u));
}
function clearStorage() {
  [localStorage, sessionStorage].forEach((s) => KEYS.forEach((k) => s.removeItem(k)));
}

function restore(): CurrentUser | null {
  try {
    // Prefer a remembered (localStorage) session, then a tab (sessionStorage) one.
    for (const store of [localStorage, sessionStorage]) {
      const access = store.getItem(TOKEN_KEY);
      const refresh = store.getItem(REFRESH_KEY);
      if (access && refresh && !isTokenExpired(access)) {
        activeStore = store;
        setApiTokens(access, refresh);
        return userFromToken(access);
      }
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
      // Write back to whichever store the session was started in.
      activeStore.setItem(TOKEN_KEY, access);
      activeStore.setItem(REFRESH_KEY, refresh);
    });
    return () => {
      setAuthFailedHandler(null);
      setTokensRefreshedHandler(null);
    };
  }, [signOut]);

  const signIn = useCallback(async (userName: string, password: string, remember = true) => {
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
    persist(u, access, refresh, remember);
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
