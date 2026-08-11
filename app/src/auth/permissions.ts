// Client-side permission model, shaped for the redesign's granular
// per-module rights (view / edit / none). The current backend only exposes
// Admin/Manager roles; until it grows granular perms, Admin => edit-all and
// Manager => whatever the users DTO carries (mocked in P1, wired in P2/P3).

export const MODULE_KEYS = [
  'dashboard',
  'reports',
  'orders',
  'shipments',
  'deliveries',
  'inventory',
  'breweries',
  'clients',
  'drivers',
  'vehicles',
  'users',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
export type PermissionLevel = 'none' | 'view' | 'edit';
export type Permissions = Record<ModuleKey, PermissionLevel>;

export function allPerms(level: PermissionLevel): Permissions {
  return Object.fromEntries(MODULE_KEYS.map((m) => [m, level])) as Permissions;
}

export function makePerms(overrides: Partial<Permissions>): Permissions {
  const base = allPerms('none');
  return { ...base, ...overrides, dashboard: 'view' };
}

export function canSee(perms: Permissions, m: ModuleKey): boolean {
  return perms[m] !== 'none';
}

export function canEdit(perms: Permissions, m: ModuleKey): boolean {
  return perms[m] === 'edit';
}
