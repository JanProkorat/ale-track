import { describe, expect, it } from 'vitest';
import { UserListItemDto, UserRoleType } from 'src/generated/api-client';
import { roleOf, ROLE_LABELS, ASSIGNABLE_ROLES } from './permissionModel';

const withRoles = (userRoles: UserRoleType[]) => new UserListItemDto({ userRoles });

describe('roleOf', () => {
  it.each(ASSIGNABLE_ROLES)('reads back a single %s role', (role) => {
    expect(roleOf(withRoles([role]))).toBe(role);
  });

  it('treats a user with no roles as a plain user', () => {
    expect(roleOf(new UserListItemDto({}))).toBe(UserRoleType.User);
  });

  // Nothing on the backend enforces one role per account, so the tie-break has to be
  // deterministic and match the backend, where an Admin claim wins.
  it('resolves a multi-role account to the most privileged role', () => {
    expect(roleOf(withRoles([UserRoleType.Driver, UserRoleType.Admin]))).toBe(UserRoleType.Admin);
    expect(roleOf(withRoles([UserRoleType.User, UserRoleType.Driver]))).toBe(UserRoleType.Driver);
  });
});

describe('ROLE_LABELS', () => {
  it('labels every assignable role in Czech', () => {
    expect(ASSIGNABLE_ROLES.map((r) => ROLE_LABELS[r])).toEqual([
      'Administrátor',
      'Uživatel',
      'Řidič',
    ]);
  });
});
