// Named slices of content that a role either allows or denies, cutting across the
// module × level matrix in permissions.ts: the matrix grants access to a module, a
// capability subtracts part of it.
//
// The backend is the authority — role capability visibility is stored in the database
// (editable via the role-capabilities admin screen) and the endpoints enforce Invoicing
// themselves (403). The backend stamps every capability the caller's roles do NOT see as
// a "cap" claim on the access token; capabilitiesFromClaims below resolves those claims
// into a full Capabilities map so a driver isn't shown chrome that would only 403 or sit
// empty.
//
// Capability.Money exists on the backend enum but nothing enforces it — no endpoint
// gates on it — so it is not offered in the registry or the admin panel (see
// capabilityRegistry.ts).
//
// LoadingBreakdown has no server-side counterpart on purpose: the Vše/F1/F2 tabs
// aggregate quantity data drivers legitimately receive for the unload view, so it is
// a decluttering capability, not a security boundary.
import { CAPABILITY_REGISTRY, type Capability } from './capabilityRegistry';
import { type UserRole } from './types';

export type Capabilities = Record<Capability, boolean>;

function all(value: boolean): Capabilities {
  return Object.fromEntries(CAPABILITY_REGISTRY.map((c) => [c.key, value])) as Capabilities;
}

// The stored capability_key column is matched case-insensitively on the backend
// (RoleCapabilityPolicy folds it with OrdinalIgnoreCase), because nothing pins its casing to
// the enum name — the PUT validator only checks non-empty and max-length. A row written with
// different casing (a direct DB edit, a seed, any writer other than the admin screen) still
// hides the same capability there, so the `cap` claim carrying that same string must resolve
// here the same way. This map is keyed by lowercase so a claim key of any casing finds its
// canonical registry key.
const CANONICAL_KEY_BY_LOWER: Readonly<Record<string, Capability>> = Object.fromEntries(
  CAPABILITY_REGISTRY.map((c) => [c.key.toLowerCase(), c.key]),
);

/**
 * Resolve the capability set from the token: Admin sees everything, otherwise every registry
 * key is allowed except those the backend named in a `cap` claim. Matching is case-insensitive
 * (see CANONICAL_KEY_BY_LOWER). Unknown claim keys are ignored — a capability removed from the
 * registry must not break an old token.
 */
export function capabilitiesFromClaims(
  roles: readonly UserRole[],
  hiddenKeys: readonly string[],
): Capabilities {
  if (roles.includes('Admin')) return all(true);

  const caps = all(true);
  for (const key of hiddenKeys) {
    const canonicalKey = CANONICAL_KEY_BY_LOWER[key.toLowerCase()];
    if (canonicalKey) caps[canonicalKey] = false;
  }
  return caps;
}

/** Most privileged of a claim's roles, matching permissionModel.roleOf for DTOs. */
export function roleOfRoles(roles: readonly UserRole[]): UserRole {
  if (roles.includes('Admin')) return 'Admin';
  if (roles.includes('Driver')) return 'Driver';
  return 'Manager';
}

/** Czech label per string-keyed UserRole, for the layout, which holds claims from the
 * token rather than a UserListItemDto and therefore cannot use ROLE_LABELS. */
export const ROLE_CLAIM_LABELS: Record<UserRole, string> = {
  Admin: 'Administrátor',
  Manager: 'Manažer',
  Driver: 'Řidič',
};
