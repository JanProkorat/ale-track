import { jwtDecode } from 'jwt-decode';
import { useMemo, useState, useEffect, useCallback, createContext } from 'react';

import { LoginUserDto, UserRoleType } from 'src/generated/api-client';
import { apiClient, setApiToken, setRefreshToken, setAuthCallbacks } from 'src/api/apiClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthUser {
     id: string;
     userName: string;
     firstName: string;
     lastName: string;
     roles: UserRoleType[];
}

export interface AuthContextValue {
     user: AuthUser | null;
     token: string | null;
     isAdmin: boolean;
     login: (userName: string, password: string) => Promise<void>;
     logout: () => void;
}

// ---------------------------------------------------------------------------
// JWT claim namespaces (.NET / Microsoft defaults)
// ---------------------------------------------------------------------------

const CLAIMS = {
     id: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
     name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
     firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
     lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
     role: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
} as const;

interface JwtPayload {
     [key: string]: unknown;
     exp?: number;
}

function parseUserFromToken(token: string): AuthUser | null {
     try {
          const decoded = jwtDecode<JwtPayload>(token);

          // Check expiration
          if (decoded.exp && decoded.exp * 1000 < Date.now()) {
               return null;
          }

          const rawRole = decoded[CLAIMS.role];
          const roles: UserRoleType[] = [];

          const parseRole = (r: unknown): UserRoleType | undefined => {
               // Handle numeric values (0, 1, ...)
               const num = Number(r);
               if (!Number.isNaN(num) && num in UserRoleType) return num as UserRoleType;
               // Handle string names ("Admin", "User", ...)
               if (typeof r === 'string' && r in UserRoleType) {
                    return UserRoleType[r as keyof typeof UserRoleType];
               }
               return undefined;
          };

          if (Array.isArray(rawRole)) {
               rawRole.forEach((r) => {
                    const role = parseRole(r);
                    if (role !== undefined) roles.push(role);
               });
          } else if (rawRole !== undefined) {
               const role = parseRole(rawRole);
               if (role !== undefined) roles.push(role);
          }

          return {
               id: String(decoded[CLAIMS.id] ?? ''),
               userName: String(decoded[CLAIMS.name] ?? ''),
               firstName: String(decoded[CLAIMS.firstName] ?? ''),
               lastName: String(decoded[CLAIMS.lastName] ?? ''),
               roles,
          };
     } catch {
          return null;
     }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'authToken';
const REFRESH_STORAGE_KEY = 'refreshToken';

export const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export default function AuthProvider({ children }: { children: React.ReactNode }) {
     const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
     const [user, setUser] = useState<AuthUser | null>(() => {
          const saved = localStorage.getItem(STORAGE_KEY);
          return saved ? parseUserFromToken(saved) : null;
     });

     // Sync token to API client on mount & changes
     useEffect(() => {
          if (token) {
               const parsed = parseUserFromToken(token);
               if (parsed) {
                    setApiToken(token);
                    setRefreshToken(localStorage.getItem(REFRESH_STORAGE_KEY));
                    setUser(parsed);
               } else {
                    // Token expired or invalid — clear
                    localStorage.removeItem(STORAGE_KEY);
                    localStorage.removeItem(REFRESH_STORAGE_KEY);
                    setApiToken(null);
                    setRefreshToken(null);
                    setToken(null);
                    setUser(null);
               }
          } else {
               setApiToken(null);
               setRefreshToken(null);
               setUser(null);
          }
     }, [token]);

     // Wire up callbacks so the fetch layer can silently update tokens
     useEffect(() => {
          setAuthCallbacks(
               (accessToken, refreshToken) => {
                    localStorage.setItem(STORAGE_KEY, accessToken);
                    localStorage.setItem(REFRESH_STORAGE_KEY, refreshToken);
                    setToken(accessToken);
               },
               () => {
                    // Refresh failed — force logout
                    localStorage.removeItem(STORAGE_KEY);
                    localStorage.removeItem(REFRESH_STORAGE_KEY);
                    setApiToken(null);
                    setRefreshToken(null);
                    setToken(null);
                    setUser(null);
               },
          );
     }, []);

     const login = useCallback(async (userName: string, password: string) => {
          const dto = new LoginUserDto();
          dto.userName = userName;
          dto.password = password;

          const response = await apiClient.loginEndpoint(dto);
          const accessToken = response.accessToken;
          if (!accessToken) {
               throw new Error('No access token in response');
          }

          localStorage.setItem(STORAGE_KEY, accessToken);
          if (response.refreshToken) {
               localStorage.setItem(REFRESH_STORAGE_KEY, response.refreshToken);
          }
          setToken(accessToken);
     }, []);

     const logout = useCallback(() => {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(REFRESH_STORAGE_KEY);
          setRefreshToken(null);
          setToken(null);
     }, []);

     const isAdmin = useMemo(() => user?.roles.includes(UserRoleType.Admin) ?? false, [user]);

     const value = useMemo<AuthContextValue>(
          () => ({ user, token, isAdmin, login, logout }),
          [user, token, isAdmin, login, logout],
     );

     return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
