import { describe, expect, it } from 'vitest';
import { CAPABILITIES, capabilitiesFor, roleOfRoles, ROLE_CLAIM_LABELS } from './capabilities';
import { type UserRole } from './types';

describe('capabilitiesFor', () => {
  it('allows everything for a plain user', () => {
    const caps = capabilitiesFor(['Manager']);
    expect(CAPABILITIES.every((c) => caps[c])).toBe(true);
  });

  it('allows everything for an admin', () => {
    const caps = capabilitiesFor(['Admin']);
    expect(CAPABILITIES.every((c) => caps[c])).toBe(true);
  });

  it('denies invoicing, the loading breakdown and money to a driver', () => {
    expect(capabilitiesFor(['Driver'])).toEqual({
      invoicing: false,
      loadingBreakdown: false,
      money: false,
    });
  });

  // Nothing on the backend enforces one role per account, so the resolver has to
  // land on the restrictive answer no matter what order the claims arrive in.
  it.each<UserRole[][]>([[['Driver', 'Manager']], [['Manager', 'Driver']]])(
    'denies when any role denies (%j)',
    (roles) => {
      expect(capabilitiesFor(roles).invoicing).toBe(false);
    }
  );

  // Matches the module matrix, where Admin bypasses permissions entirely.
  it('lets an admin claim win over a denying role', () => {
    expect(capabilitiesFor(['Driver', 'Admin']).invoicing).toBe(true);
  });

  it('denies nothing for a role-less user, leaving access to the permission matrix', () => {
    const caps = capabilitiesFor([]);
    expect(CAPABILITIES.every((c) => caps[c])).toBe(true);
  });
});

describe('roleOfRoles', () => {
  it.each<UserRole>(['Admin', 'Manager', 'Driver'])('resolves a single %s role to itself', (role) => {
    expect(roleOfRoles([role])).toBe(role);
  });

  // Regression guard for the Sidebar/AccountMenu bug this helper fixed: a driver must
  // never resolve to Manager, regardless of which order the claims arrive in. This would
  // fail if a future rewrite picked roles[0] (or any order-dependent strategy) instead of
  // an explicit Driver check.
  it.each<UserRole[][]>([[['Driver', 'Manager']], [['Manager', 'Driver']]])(
    'resolves a driver among managers to Driver (%j)',
    (roles) => {
      expect(roleOfRoles(roles)).toBe('Driver');
    }
  );

  // Matches capabilitiesFor's Admin short-circuit — Admin must win even over a role that
  // would otherwise restrict. This fails if the Admin check is ever moved after the
  // Driver check.
  it('resolves Driver+Admin to Admin, not Driver', () => {
    expect(roleOfRoles(['Driver', 'Admin'])).toBe('Admin');
  });

  it('resolves no roles to Manager', () => {
    expect(roleOfRoles([])).toBe('Manager');
  });
});

describe('ROLE_CLAIM_LABELS', () => {
  it.each<[UserRole, string]>([
    ['Admin', 'Administrátor'],
    ['Manager', 'Manažer'],
    ['Driver', 'Řidič'],
  ])('labels %s in Czech as %s', (role, label) => {
    expect(ROLE_CLAIM_LABELS[role]).toBe(label);
  });
});
