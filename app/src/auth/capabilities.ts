// Named slices of content that a role either allows or denies, cutting across the
// module × level matrix in permissions.ts: the matrix grants access to a module, a
// capability subtracts part of it.
//
// This table mirrors the backend's RoleCapabilities, which is the authority — the
// endpoints enforce Invoicing and Money themselves (403). The copy here exists so a
// driver isn't shown chrome that would only 403 or sit empty.
//
// LoadingBreakdown has no server-side counterpart on purpose: the Vše/F1/F2 tabs
// aggregate quantity data drivers legitimately receive for the unload view, so it is
// a decluttering capability, not a security boundary.
import { type UserRole } from './types';

export const CAPABILITIES = ['invoicing', 'loadingBreakdown', 'money'] as const;

export type Capability = (typeof CAPABILITIES)[number];
export type Capabilities = Record<Capability, boolean>;

/** Capabilities each role is denied. A role absent here is denied nothing. */
const DENIED_BY_ROLE: Partial<Record<UserRole, readonly Capability[]>> = {
  Driver: ['invoicing', 'loadingBreakdown', 'money'],
};

function all(value: boolean): Capabilities {
  return Object.fromEntries(CAPABILITIES.map((c) => [c, value])) as Capabilities;
}

/**
 * Resolve a role set into capabilities. Admin short-circuits to all-allowed, matching
 * the module matrix where Admin bypasses permissions entirely; otherwise the rule is
 * deny-if-any-denies, because nothing on the backend enforces one role per account.
 */
export function capabilitiesFor(roles: readonly UserRole[]): Capabilities {
  if (roles.includes('Admin')) return all(true);

  const caps = all(true);
  for (const role of roles) {
    for (const denied of DENIED_BY_ROLE[role] ?? []) {
      caps[denied] = false;
    }
  }
  return caps;
}
