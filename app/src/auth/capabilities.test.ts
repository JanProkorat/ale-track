import { describe, expect, it } from 'vitest';
import { CAPABILITIES, capabilitiesFor } from './capabilities';
import { type UserRole } from './types';

describe('capabilitiesFor', () => {
  it('allows everything for a plain user', () => {
    const caps = capabilitiesFor(['User']);
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
  it.each<UserRole[][]>([[['Driver', 'User']], [['User', 'Driver']]])(
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
