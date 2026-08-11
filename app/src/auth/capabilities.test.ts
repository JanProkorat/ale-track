import { describe, expect, it } from 'vitest';
import { capabilitiesFromClaims, roleOfRoles, ROLE_CLAIM_LABELS } from './capabilities';
import { type UserRole } from './types';

describe('capabilitiesFromClaims', () => {
  it('allows everything when no capability is hidden', () => {
    const caps = capabilitiesFromClaims(['Manager'], []);
    expect(Object.values(caps).every(Boolean)).toBe(true);
  });

  it('hides exactly the keys the token names', () => {
    expect(capabilitiesFromClaims(['Driver'], ['Invoicing', 'Money'])).toEqual({
      Invoicing: false,
      LoadingBreakdown: true,
      Money: false,
    });
  });

  it('ignores an unknown claim key', () => {
    expect(capabilitiesFromClaims(['Driver'], ['Wizardry']).Invoicing).toBe(true);
  });

  it('lets Admin override any hidden key', () => {
    expect(capabilitiesFromClaims(['Admin'], ['Invoicing']).Invoicing).toBe(true);
  });

  // The backend matches capability_key case-insensitively (RoleCapabilityPolicy folds it with
  // OrdinalIgnoreCase) because nothing pins its casing to the enum name — a row written by a
  // direct DB edit or a seed, not just the admin screen, could carry any casing. The `cap`
  // claim carries that same string verbatim, so a case-sensitive match here would silently
  // un-hide a capability the backend is actively hiding and 403ing.
  it('hides a capability whose claim key differs only in casing', () => {
    expect(capabilitiesFromClaims(['Driver'], ['money']).Money).toBe(false);
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

  // Matches capabilitiesFromClaims's Admin short-circuit — Admin must win even over a role
  // that would otherwise restrict. This fails if the Admin check is ever moved after the
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
