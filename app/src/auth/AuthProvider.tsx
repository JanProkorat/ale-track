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
import { LoginUserDto } from 'src/generated/api-client';
import { api } from 'src/api/apiClient';
import { setApiTokens, setAuthFailedHandler, setTokensRefreshedHandler } from 'src/api/apiClient';
import { apiErrorMessage } from 'src/api/errors';

const TOKEN_KEY = 'authToken';
const REFRESH_KEY = 'refreshToken';
const USER_KEY = 'aletrack.user';
const MODE_KEY = 'aletrack.authMode'; // 'real' | 'demo'

interface AuthContextValue {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  isDemo: boolean;
  /** Real login against the backend. */
  signIn: (userName: string, password: string) => Promise<void>;
  /** Client-side demo session (no backend) — for UI review / permission demo. */
  signInDemo: (u: CurrentUser) => void;
  switchUser: (u: CurrentUser) => void;
  signOut: () => void;
  canSee: (m: ModuleKey) => boolean;
  canEdit: (m: ModuleKey) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function persistReal(u: CurrentUser, access: string, refresh: string) {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
  localStorage.setItem(USER_KEY, JSON.stringify(u));
  localStorage.setItem(MODE_KEY, 'real');
}
function persistDemo(u: CurrentUser) {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.setItem(USER_KEY, JSON.stringify(u));
  localStorage.setItem(MODE_KEY, 'demo');
}
function clearStorage() {
  [TOKEN_KEY, REFRESH_KEY, USER_KEY, MODE_KEY].forEach((k) => localStorage.removeItem(k));
}

function restore(): { user: CurrentUser | null; demo: boolean } {
  const mode = localStorage.getItem(MODE_KEY);
  try {
    if (mode === 'real') {
      const access = localStorage.getItem(TOKEN_KEY);
      const refresh = localStorage.getItem(REFRESH_KEY);
      if (access && refresh && !isTokenExpired(access)) {
        setApiTokens(access, refresh);
        return { user: userFromToken(access), demo: false };
      }
      clearStorage();
    } else if (mode === 'demo') {
      const raw = localStorage.getItem(USER_KEY);
      if (raw) return { user: JSON.parse(raw) as CurrentUser, demo: true };
    }
  } catch {
    clearStorage();
  }
  return { user: null, demo: false };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [{ user, demo }, setState] = useState(restore);

  const signOut = useCallback(() => {
    clearStorage();
    setApiTokens(null, null);
    setState({ user: null, demo: false });
  }, []);

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
    persistReal(u, access, refresh);
    setState({ user: u, demo: false });
  }, []);

  const signInDemo = useCallback((u: CurrentUser) => {
    setApiTokens(null, null);
    persistDemo(u);
    setState({ user: u, demo: true });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isDemo: demo,
      signIn,
      signInDemo,
      switchUser: signInDemo,
      signOut,
      canSee: (m) => (user ? canSeePerms(user.perms, m) : false),
      canEdit: (m) => (user ? canEditPerms(user.perms, m) : false),
    }),
    [user, demo, signIn, signInDemo, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
