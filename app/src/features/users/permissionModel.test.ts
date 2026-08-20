import { describe, expect, it } from 'vitest';
import { UserListItemDto, UserRoleType } from 'src/generated/api-client';
import { MODULE_KEYS } from 'src/auth/permissions';
import { NAV_GROUPS, navPermModule } from 'src/layout/nav-config';
import { roleOf, isAdminUser, ROLE_LABELS, ASSIGNABLE_ROLES, PERM_MODULES } from './permissionModel';

const withRoles = (userRoles: UserRoleType[]) => new UserListItemDto({ userRoles });

/**
 * The shape the API really sends. The generated client types `userRoles` as `UserRoleType[]`, but
 * enums serialize as strings (`JsonStringEnumConverter`), so a live response carries `['Driver']`.
 * Tests that only used the numeric form let a bug ship where every user read as Manažer — the
 * cast is deliberate, to reproduce runtime rather than the declared type.
 */
const withWireRoles = (userRoles: string[]) =>
  new UserListItemDto({ userRoles: userRoles as unknown as UserRoleType[] });

describe('roleOf', () => {
  it.each(ASSIGNABLE_ROLES)('reads back a single %s role', (role) => {
    expect(roleOf(withRoles([role]))).toBe(role);
  });

  it('treats a user with no roles as a plain user', () => {
    expect(roleOf(new UserListItemDto({}))).toBe(UserRoleType.Manager);
  });

  // Nothing on the backend enforces one role per account, so the tie-break has to be
  // deterministic and match the backend, where an Admin claim wins.
  it('resolves a multi-role account to the most privileged role', () => {
    expect(roleOf(withRoles([UserRoleType.Driver, UserRoleType.Admin]))).toBe(UserRoleType.Admin);
    expect(roleOf(withRoles([UserRoleType.Manager, UserRoleType.Driver]))).toBe(UserRoleType.Driver);
  });

  // The regression this guards: roles arrive as strings, and comparing them against the numeric
  // members silently never matched, so a driver — and an admin — both displayed as Manažer.
  it.each([
    ['Admin', UserRoleType.Admin],
    ['Manager', UserRoleType.Manager],
    ['Driver', UserRoleType.Driver],
  ])('reads a %s role that arrives as a string', (wireRole, expected) => {
    expect(roleOf(withWireRoles([wireRole as string]))).toBe(expected);
  });

  it('still resolves the most privileged role when they arrive as strings', () => {
    expect(roleOf(withWireRoles(['Driver', 'Admin']))).toBe(UserRoleType.Admin);
  });

  it('drops an unrecognised role rather than treating it as privileged', () => {
    expect(roleOf(withWireRoles(['Wizard']))).toBe(UserRoleType.Manager);
  });
});

/**
 * The permission matrix is derived from the nav, so a nav item that gates on a module another
 * item already covers (the garage-sale Reporty gates on `sales`, like Prodeje) must not add a second
 * row — a duplicated row would let the two halves of the form disagree about one module.
 */
describe('PERM_MODULES', () => {
  it('has exactly one row per permissionable module', () => {
    const keys = PERM_MODULES.map((m) => m.key);

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(MODULE_KEYS.length - 1); // every module but dashboard
    expect(keys).not.toContain('dashboard');
  });

  it('keeps a row for a module whose nav item is not the only one gating on it', () => {
    const salesItems = NAV_GROUPS.flatMap((g) => g.items).filter((i) => navPermModule(i) === 'sales');

    expect(salesItems.length).toBeGreaterThan(1);
    expect(PERM_MODULES.filter((m) => m.key === 'sales')).toHaveLength(1);
  });
});

describe('navPermModule', () => {
  it('falls back to the nav key when no permission module is declared', () => {
    expect(navPermModule({ key: 'orders' })).toBe('orders');
  });

  it('prefers the declared permission module over the nav key', () => {
    expect(navPermModule({ key: 'salesReports', permModule: 'sales' })).toBe('sales');
  });
});

describe('isAdminUser', () => {
  it('recognises an admin whose role arrives as a string', () => {
    expect(isAdminUser(withWireRoles(['Admin']))).toBe(true);
  });

  it('recognises an admin whose role arrives as the numeric enum', () => {
    expect(isAdminUser(withRoles([UserRoleType.Admin]))).toBe(true);
  });

  it('does not treat a driver as an admin', () => {
    expect(isAdminUser(withWireRoles(['Driver']))).toBe(false);
  });
});

describe('ROLE_LABELS', () => {
  it('labels every assignable role in Czech', () => {
    expect(ASSIGNABLE_ROLES.map((r) => ROLE_LABELS[r])).toEqual([
      'Administrátor',
      'Manažer',
      'Řidič',
    ]);
  });
});
