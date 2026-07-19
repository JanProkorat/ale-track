import { jwtDecode } from 'jwt-decode';
import { type CurrentUser, type UserRole } from './types';
import { allPerms, makePerms, type Permissions } from './permissions';

// The backend issues claims under the standard ClaimTypes URIs.
const CLAIM = {
  id: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
  name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
  given: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
  surname: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
  role: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
} as const;

interface JwtPayload {
  exp?: number;
  [key: string]: unknown;
}

function asArray(v: unknown): string[] {
  if (v == null) return [];
  return Array.isArray(v) ? v.map(String) : [String(v)];
}

/** Map the backend's binary roles onto the granular client permission model.
 * Admin → edit everything; User → edit everything except the admin-only Users
 * module. (The BE has no per-module rights yet; this is the FE shape.) */
export function roleToPerms(roles: UserRole[]): Permissions {
  if (roles.includes('Admin')) return allPerms('edit');
  return makePerms({
    orders: 'edit',
    shipments: 'edit',
    deliveries: 'edit',
    inventory: 'edit',
    breweries: 'edit',
    clients: 'edit',
    drivers: 'edit',
    vehicles: 'edit',
    users: 'none',
  });
}

export function isTokenExpired(accessToken: string): boolean {
  try {
    const { exp } = jwtDecode<JwtPayload>(accessToken);
    return exp != null && exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export function userFromToken(accessToken: string): CurrentUser | null {
  try {
    const p = jwtDecode<JwtPayload>(accessToken);
    const roles = asArray(p[CLAIM.role]).filter((r): r is UserRole => r === 'Admin' || r === 'User');
    return {
      id: String(p[CLAIM.id] ?? ''),
      userName: String(p[CLAIM.name] ?? ''),
      firstName: p[CLAIM.given] ? String(p[CLAIM.given]) : undefined,
      lastName: p[CLAIM.surname] ? String(p[CLAIM.surname]) : undefined,
      roles: roles.length ? roles : ['User'],
      perms: roleToPerms(roles),
    };
  } catch {
    return null;
  }
}
