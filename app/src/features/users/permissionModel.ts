// Bridges the client permission model (permissions.ts: ModuleKey × 'none'|'view'
// |'edit') and the API's ModulePermissionDto (ModuleType × PermissionLevel).
import { NAV_GROUPS, navPermModule } from 'src/layout/nav-config';
import {
  makePerms,
  type ModuleKey,
  type PermissionLevel as FeLevel,
  type Permissions,
} from 'src/auth/permissions';
import {
  ModuleType,
  ModulePermissionDto,
  PermissionLevel as ApiLevel,
  UserRoleType,
  type UserListItemDto,
} from 'src/generated/api-client';

/**
 * The permissionable modules (dashboard is always visible, excluded), in nav order.
 *
 * Deduped by module rather than taken straight from the nav: several items may gate on one
 * module (Reporty prodejny gates on `sales`, like Prodeje), and a duplicated row would let the
 * two halves of the permission form disagree about the same module. The first item wins, so the
 * label stays the one for the module's primary screen.
 */
export const PERM_MODULES: { key: ModuleKey; label: string }[] = NAV_GROUPS.flatMap((g) => g.items)
  .map((item) => ({ key: navPermModule(item), label: item.label }))
  .filter((module, index, all) =>
    module.key !== 'dashboard' && all.findIndex((m) => m.key === module.key) === index
  );

const KEY_TO_MODULE: Record<string, ModuleType> = {
  reports: ModuleType.Reports,
  orders: ModuleType.Orders,
  shipments: ModuleType.Shipments,
  deliveries: ModuleType.Deliveries,
  inventory: ModuleType.Inventory,
  sales: ModuleType.Sales,
  breweries: ModuleType.Breweries,
  clients: ModuleType.Clients,
  drivers: ModuleType.Drivers,
  vehicles: ModuleType.Vehicles,
  users: ModuleType.Users,
};

const FE_TO_API: Record<FeLevel, ApiLevel> = {
  none: ApiLevel.None,
  view: ApiLevel.View,
  edit: ApiLevel.Edit,
};

// Enums are numeric in the generated client but arrive as strings on the wire —
// resolve both.
function moduleToKey(m: ModuleType | string | number | undefined): ModuleKey | undefined {
  if (m == null) return undefined;
  const name = typeof m === 'number' ? ModuleType[m] : String(m);
  return name ? (name.toLowerCase() as ModuleKey) : undefined;
}
function apiToFe(l: ApiLevel | string | number | undefined): FeLevel {
  if (l == null) return 'none';
  const name = typeof l === 'number' ? ApiLevel[l] : String(l);
  const lower = name?.toLowerCase();
  return lower === 'view' || lower === 'edit' ? lower : 'none';
}

/** Client permission map → API DTOs (only non-none modules are sent). */
export function permsToDtos(perms: Permissions): ModulePermissionDto[] {
  return PERM_MODULES.filter((m) => perms[m.key] !== 'none').map(
    (m) => new ModulePermissionDto({ module: KEY_TO_MODULE[m.key], level: FE_TO_API[perms[m.key]] })
  );
}

/** API DTOs → client permission map (missing/none modules default to none). */
export function dtosToPerms(dtos: ModulePermissionDto[] | undefined): Permissions {
  const overrides: Partial<Permissions> = {};
  for (const d of dtos ?? []) {
    const key = moduleToKey(d.module);
    if (key) overrides[key] = apiToFe(d.level);
  }
  return makePerms(overrides);
}

/**
 * Resolve one role to the numeric enum. Same wire caveat as `moduleToKey` above: the generated
 * client types `userRoles` as `UserRoleType[]`, but the API serializes enums as strings
 * (`JsonStringEnumConverter`), so what actually arrives is `['Driver']`. Comparing those against
 * the numeric members silently never matches — every user then reads as the fallback role.
 */
export function roleFromApi(role: UserRoleType | string | number | undefined): UserRoleType | undefined {
  if (role == null) return undefined;
  if (typeof role === 'number') return role;
  const resolved = UserRoleType[role as keyof typeof UserRoleType];
  return typeof resolved === 'number' ? resolved : undefined;
}

/** The caller's roles as numeric enum members, with anything unrecognised dropped. */
function rolesOf(u: Pick<UserListItemDto, 'userRoles'>): UserRoleType[] {
  return (u.userRoles ?? [])
    .map(roleFromApi)
    .filter((role): role is UserRoleType => role !== undefined);
}

export function isAdminUser(u: Pick<UserListItemDto, 'userRoles'>): boolean {
  return rolesOf(u).includes(UserRoleType.Admin);
}

/** The three assignable roles, in the order the form offers them. */
export const ASSIGNABLE_ROLES = [UserRoleType.Admin, UserRoleType.Manager, UserRoleType.Driver] as const;

export const ROLE_LABELS: Record<UserRoleType, string> = {
  [UserRoleType.Admin]: 'Administrátor',
  [UserRoleType.Manager]: 'Manažer',
  [UserRoleType.Driver]: 'Řidič',
};

/**
 * The single role a user is treated as. The form assigns exactly one, but nothing on
 * the backend enforces that, so a user carrying several resolves to the most privileged
 * — matching how the backend's capability check lets an Admin claim win.
 */
export function roleOf(u: Pick<UserListItemDto, 'userRoles'>): UserRoleType {
  const roles = rolesOf(u);
  if (roles.includes(UserRoleType.Admin)) return UserRoleType.Admin;
  if (roles.includes(UserRoleType.Driver)) return UserRoleType.Driver;
  return UserRoleType.Manager;
}

/** Counts of edit/view grants for the list summary. */
export function permCounts(u: Pick<UserListItemDto, 'permissions'>): { edit: number; view: number } {
  let edit = 0;
  let view = 0;
  for (const d of u.permissions ?? []) {
    const lvl = apiToFe(d.level);
    if (lvl === 'edit') edit += 1;
    else if (lvl === 'view') view += 1;
  }
  return { edit, view };
}
