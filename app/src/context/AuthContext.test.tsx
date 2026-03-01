import type { ReactNode } from 'react';

import { it, vi, expect, describe, beforeEach } from 'vitest';

import { act, renderHook } from 'src/test/test-utils';

import { useAuth, AuthProvider } from './AuthContext';

// -------------------------------------------------------------------

const ROLE_CLAIM = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
const NAME_CLAIM = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name';
const ID_CLAIM = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier';

const mockJwtDecode = vi.fn();

vi.mock('jwt-decode', () => ({
     jwtDecode: (...args: any[]) => mockJwtDecode(...args),
}));

function createDecodedToken(overrides: Record<string, any> = {}) {
     return {
          exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
          [ROLE_CLAIM]: 0, // Admin
          [NAME_CLAIM]: 'Test User',
          [ID_CLAIM]: 'user-123',
          ...overrides,
     };
}

function wrapper({ children }: { children: ReactNode }) {
     return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthContext', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          localStorage.clear();
     });

     describe('useAuth', () => {
          it('throws when used outside AuthProvider', () => {
               expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used within an AuthProvider');
          });
     });

     describe('AuthProvider', () => {
          it('initializes with no user when no token in localStorage', () => {
               const { result } = renderHook(() => useAuth(), { wrapper });
               expect(result.current.user).toBeNull();
               expect(result.current.isAuthenticated).toBe(false);
               expect(result.current.isInitialized).toBe(true);
          });

          it('initializes with user from valid localStorage token', () => {
               localStorage.setItem('authToken', 'valid-token');
               mockJwtDecode.mockReturnValue(createDecodedToken());

               const { result } = renderHook(() => useAuth(), { wrapper });
               expect(result.current.user).not.toBeNull();
               expect(result.current.user!.name).toBe('Test User');
               expect(result.current.isAuthenticated).toBe(true);
          });

          it('clears expired token from localStorage on init', () => {
               localStorage.setItem('authToken', 'expired-token');
               mockJwtDecode.mockReturnValue(createDecodedToken({ exp: Math.floor(Date.now() / 1000) - 3600 }));

               const { result } = renderHook(() => useAuth(), { wrapper });
               expect(result.current.user).toBeNull();
               expect(result.current.isAuthenticated).toBe(false);
               expect(localStorage.getItem('authToken')).toBeNull();
          });

          it('clears invalid token from localStorage on init', () => {
               localStorage.setItem('authToken', 'invalid-token');
               mockJwtDecode.mockImplementation(() => {
                    throw new Error('Invalid token');
               });

               const { result } = renderHook(() => useAuth(), { wrapper });
               expect(result.current.user).toBeNull();
               expect(localStorage.getItem('authToken')).toBeNull();
          });

          it('maps claim keys to user properties', () => {
               localStorage.setItem('authToken', 'valid-token');
               mockJwtDecode.mockReturnValue(createDecodedToken());

               const { result } = renderHook(() => useAuth(), { wrapper });
               expect(result.current.user!.name).toBe('Test User');
               expect(result.current.user!.id).toBe('user-123');
          });

          it('preserves unmapped claims on user object', () => {
               localStorage.setItem('authToken', 'valid-token');
               mockJwtDecode.mockReturnValue(createDecodedToken({ customClaim: 'customValue' }));

               const { result } = renderHook(() => useAuth(), { wrapper });
               expect(result.current.user!.customClaim).toBe('customValue');
          });
     });

     describe('signIn', () => {
          it('stores token in localStorage and sets user', () => {
               mockJwtDecode.mockReturnValue(createDecodedToken());

               const { result } = renderHook(() => useAuth(), { wrapper });
               act(() => {
                    result.current.signIn('new-token');
               });

               expect(localStorage.getItem('authToken')).toBe('new-token');
               expect(result.current.user).not.toBeNull();
               expect(result.current.isAuthenticated).toBe(true);
          });

          it('sets user name from token claims', () => {
               mockJwtDecode.mockReturnValue(createDecodedToken({ [NAME_CLAIM]: 'John Doe' }));

               const { result } = renderHook(() => useAuth(), { wrapper });
               act(() => {
                    result.current.signIn('token');
               });

               expect(result.current.user!.name).toBe('John Doe');
          });

          it('clears user on invalid token during signIn', () => {
               mockJwtDecode.mockImplementation(() => {
                    throw new Error('bad token');
               });

               const { result } = renderHook(() => useAuth(), { wrapper });
               act(() => {
                    result.current.signIn('bad-token');
               });

               expect(result.current.user).toBeNull();
               expect(result.current.isAuthenticated).toBe(false);
               expect(localStorage.getItem('authToken')).toBeNull();
          });
     });

     describe('signOut', () => {
          it('clears user and removes token from localStorage', async () => {
               mockJwtDecode.mockReturnValue(createDecodedToken());

               const { result } = renderHook(() => useAuth(), { wrapper });
               act(() => {
                    result.current.signIn('token');
               });
               expect(result.current.isAuthenticated).toBe(true);

               await act(async () => {
                    await result.current.signOut();
               });

               expect(result.current.user).toBeNull();
               expect(result.current.isAuthenticated).toBe(false);
               expect(localStorage.getItem('authToken')).toBeNull();
          });
     });
});
