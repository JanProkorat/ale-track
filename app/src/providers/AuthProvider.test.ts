import { UserRoleType } from 'src/generated/api-client';

// ---------------------------------------------------------------------------
// Replicate the CLAIMS mapping and parseUserFromToken logic from AuthProvider
// so we can unit-test the pure function without needing to render React context.
// ---------------------------------------------------------------------------

const CLAIMS = {
     id: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
     name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
     firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
     lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
     role: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
} as const;

interface AuthUser {
     id: string;
     userName: string;
     firstName: string;
     lastName: string;
     roles: UserRoleType[];
}

interface JwtPayload {
     [key: string]: unknown;
     exp?: number;
}

/**
 * Mirror of the private `parseUserFromToken` from AuthProvider, but accepts
 * an already-decoded payload so we can test the logic without jwt-decode.
 */
function parseUserFromDecodedToken(decoded: JwtPayload): AuthUser | null {
     try {
          if (decoded.exp && decoded.exp * 1000 < Date.now()) {
               return null;
          }

          const rawRole = decoded[CLAIMS.role];
          const roles: UserRoleType[] = [];

          const parseRole = (r: unknown): UserRoleType | undefined => {
               const num = Number(r);
               if (!Number.isNaN(num) && num in UserRoleType) return num as UserRoleType;
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
// Helpers
// ---------------------------------------------------------------------------

function buildPayload(overrides: Partial<JwtPayload> = {}): JwtPayload {
     return {
          [CLAIMS.id]: '42',
          [CLAIMS.name]: 'jdoe',
          [CLAIMS.firstName]: 'John',
          [CLAIMS.lastName]: 'Doe',
          exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
          ...overrides,
     };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseUserFromToken logic', () => {
     beforeEach(() => {
          vi.useRealTimers();
     });

     it('extracts user fields from Microsoft namespace claims', () => {
          const user = parseUserFromDecodedToken(
               buildPayload({
                    [CLAIMS.role]: 'Admin',
               }),
          );

          expect(user).not.toBeNull();
          expect(user!.id).toBe('42');
          expect(user!.userName).toBe('jdoe');
          expect(user!.firstName).toBe('John');
          expect(user!.lastName).toBe('Doe');
     });

     it('returns null for expired tokens', () => {
          const expiredPayload = buildPayload({
               exp: Math.floor(Date.now() / 1000) - 60, // 1 minute ago
          });

          expect(parseUserFromDecodedToken(expiredPayload)).toBeNull();
     });

     it('parses a single string role ("Admin" → UserRoleType.Admin)', () => {
          const user = parseUserFromDecodedToken(
               buildPayload({ [CLAIMS.role]: 'Admin' }),
          );

          expect(user).not.toBeNull();
          expect(user!.roles).toEqual([UserRoleType.Admin]);
     });

     it('parses a single numeric role (0 → UserRoleType.Admin)', () => {
          const user = parseUserFromDecodedToken(
               buildPayload({ [CLAIMS.role]: 0 }),
          );

          expect(user).not.toBeNull();
          expect(user!.roles).toEqual([UserRoleType.Admin]);
     });

     it('parses a single numeric role (1 → UserRoleType.User)', () => {
          const user = parseUserFromDecodedToken(
               buildPayload({ [CLAIMS.role]: 1 }),
          );

          expect(user).not.toBeNull();
          expect(user!.roles).toEqual([UserRoleType.User]);
     });

     it('parses an array of roles', () => {
          const user = parseUserFromDecodedToken(
               buildPayload({ [CLAIMS.role]: ['Admin', 1] }),
          );

          expect(user).not.toBeNull();
          expect(user!.roles).toEqual([UserRoleType.Admin, UserRoleType.User]);
     });

     it('handles missing claims by defaulting to empty strings', () => {
          const minimal: JwtPayload = {
               exp: Math.floor(Date.now() / 1000) + 3600,
          };

          const user = parseUserFromDecodedToken(minimal);

          expect(user).not.toBeNull();
          expect(user!.id).toBe('');
          expect(user!.userName).toBe('');
          expect(user!.firstName).toBe('');
          expect(user!.lastName).toBe('');
          expect(user!.roles).toEqual([]);
     });

     it('ignores unknown / invalid role values', () => {
          const user = parseUserFromDecodedToken(
               buildPayload({ [CLAIMS.role]: ['Admin', 'SuperHero', 999, undefined] }),
          );

          expect(user).not.toBeNull();
          // 'Admin' → valid, 'SuperHero' → ignored, 999 → ignored, undefined → ignored
          expect(user!.roles).toEqual([UserRoleType.Admin]);
     });

     it('returns empty roles array when role claim is missing', () => {
          const payload = buildPayload();
          // Ensure no role claim exists
          delete payload[CLAIMS.role];

          const user = parseUserFromDecodedToken(payload);

          expect(user).not.toBeNull();
          expect(user!.roles).toEqual([]);
     });

     it('treats a token with no exp as valid (non-expiring)', () => {
          const payload = buildPayload();
          delete payload.exp;

          const user = parseUserFromDecodedToken(payload);

          expect(user).not.toBeNull();
          expect(user!.id).toBe('42');
     });

     it('parses numeric role passed as a string ("0" → UserRoleType.Admin)', () => {
          const user = parseUserFromDecodedToken(
               buildPayload({ [CLAIMS.role]: '0' }),
          );

          expect(user).not.toBeNull();
          expect(user!.roles).toEqual([UserRoleType.Admin]);
     });
});
