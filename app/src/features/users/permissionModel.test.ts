import { describe, expect, it } from 'vitest';
import { UserListItemDto, UserRoleType } from 'src/generated/api-client';
import { roleOf, isAdminUser, ROLE_LABELS, ASSIGNABLE_ROLES } from './permissionModel';

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
