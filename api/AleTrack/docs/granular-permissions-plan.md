# Granular per-module permissions (BE + FE)

Decisions: existing non-admin users backfill to **Edit on all modules**; scope =
**full** (assign + enforce). Admin role stays a superuser flag (Edit everything;
matrix hidden in the UI).

## Model
- `ModuleType` enum: Orders, Shipments, Deliveries, Inventory, Breweries, Clients, Drivers, Vehicles, Users.
- `PermissionLevel` enum: None=0, View=1, Edit=2.
- New entity `UserPermission { long UserId; ModuleType Module; PermissionLevel Level; }` (+ nav on User). Keep `UserRole` for the Admin flag.

## Backend phases
1. **Domain**: enums, `UserPermission` entity + config, DbSet, `User.Permissions` nav.
2. **Migration** `AddUserPermissions`: create table; backfill — every non-admin user gets 9 Edit rows (raw SQL). Admin needs none (handler short-circuits).
3. **JWT/AppContext**: `JwtService` emits `perm` claims (`"Orders:Edit"`, …) from the user's UserPermission rows; keep Role claims. `AppContext` exposes `IReadOnlyDictionary<ModuleType,PermissionLevel> Permissions`.
4. **Authorization**: `ModulePermissionRequirement(Module, MinLevel)` + `ModulePermissionHandler` (Admin role ⇒ pass; else perm ≥ MinLevel). Register policies `"{Module}:{View|Edit}"` (18). `EndpointDefinitionExtensions.RequirePermission(module, minLevel)` → `RequireAuthorization("{module}:{level}")`; add `RequireAuthenticated()` for cross-cutting endpoints.
5. **Endpoint pass** (mechanical, ~74): replace `RequireRole(User)` with `RequirePermission(<module>, View|Edit)` — GET→View, POST/PUT/DELETE→Edit. Mapping:
   - Orders/*→Orders · OutgoingShipments/*→Shipments · ProductDeliveries/*→Deliveries · InventoryItems/*→Inventory
   - Breweries/*, Products/*, BreweryReminders/*→Breweries · Clients/*, ClientContacts/ClientNotes/ClientReminders/*→Clients
   - Drivers/*→Drivers · Vehicles/*→Vehicles · Users/*→Users (Admin-only today → Users View/Edit)
   - MasterData, ExchangeRates, Reports, upcoming-reminders → `RequireAuthenticated()` (any logged-in user)
6. **User DTOs/handlers**: Create/Update/ListUserDto keep `UserRoles` + add `List<ModulePermissionDto>{Module,Level}`; handlers replace UserPermission rows (skip when Admin). List projects permissions.

## Client + FE
7. `dotnet build` → `dotnet ef database update` (apply migration) → `yarn generate-api` (regen client; needs BE running).
8. FE: `jwt.ts` reads `perm` claims (Admin ⇒ allPerms edit). Uživatelé screen: list with permission summary + form with Admin toggle + none/view/edit matrix.

## Guards
Backend feature code is fair game; NEVER touch `appsettings*`, `launchSettings.json`, `.env*`, secrets. Migration is applied to the dev DB — backfill preserves existing access.
