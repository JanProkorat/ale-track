import { jwtDecode } from 'jwt-decode';
import { type CurrentUser, type UserRole } from './types';
import {
  allPerms,
  makePerms,
  MODULE_KEYS,
  type ModuleKey,
  type PermissionLevel,
  type Permissions,
} from './permissions';

// The backend issues standard-URI claims plus one custom "perm" claim per
// module carrying "Module:Level" (e.g. "Orders:Edit").
const CLAIM = {
  id: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
  name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
  given: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
  surname: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
  role: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
  perm: 'perm',
} as const;

interface JwtPayload {
  exp?: number;
  [key: string]: unknown;
}

function asArray(v: unknown): string[] {
  if (v == null) return [];
  return Array.isArray(v) ? v.map(String) : [String(v)];
}

/** Build the client permission map from the JWT's "perm" claims (each
 * "Module:Level", e.g. "Orders:Edit"). Admins get edit-everything. */
function permsFromClaims(values: string[]): Permissions {
  const overrides: Partial<Permissions> = {};
  for (const v of values) {
    const [modName, levelName] = v.split(':');
    const key = modName?.toLowerCase() as ModuleKey;
    const level = levelName?.toLowerCase();
    if (
      MODULE_KEYS.includes(key) &&
      (level === 'none' || level === 'view' || level === 'edit')
    ) {
      overrides[key] = level as PermissionLevel;
    }
  }
  return makePerms(overrides);
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
    const isAdmin = roles.includes('Admin');
    return {
      id: String(p[CLAIM.id] ?? ''),
      userName: String(p[CLAIM.name] ?? ''),
      firstName: p[CLAIM.given] ? String(p[CLAIM.given]) : undefined,
      lastName: p[CLAIM.surname] ? String(p[CLAIM.surname]) : undefined,
      roles: roles.length ? roles : ['User'],
      perms: isAdmin ? allPerms('edit') : permsFromClaims(asArray(p[CLAIM.perm])),
    };
  } catch {
    return null;
  }
}
