# Configurable role capabilities

**Date:** 2026-08-11
**Status:** approved design, not yet implemented
**Builds on:** `2026-08-10-role-based-content-visibility-design.md` (phase 1 — the `Driver`
role and the capability layer, implemented and staged)

## Problem

Phase 1 hard-codes what each role may see: `RoleCapabilities.cs` on the backend and a
mirrored `DENIED_BY_ROLE` table in `app/src/auth/capabilities.ts`. Two consequences:

- Deciding a further component is not for drivers is a code change and a deploy.
- Letting a role see something it currently cannot is the same.

The ask: set component visibility **at role level**, editable in the app. Explicitly *not*
per user — all drivers see the same thing. Future roles should be able to carry their own
module and component sets.

## Decision

Roles stay in code; **what a role may see becomes data**.

```
CODE (typed, compile-checked)              DB (editable, no deploy)
─────────────────────────────              ────────────────────────
Capability keys and their gates:           role_capabilities
  can('invoicing') in the component          role   | capability_key    | is_visible
  RequireCapability(...) on the endpoint      Driver | invoicing         | false
                                              Driver | loadingBreakdown  | false
UserRoleType enum            (unchanged)      Driver | returnsCard       | true
UserPermission per-user matrix (unchanged)
```

`UserRoleType` remains an enum and the per-user module matrix is untouched, so there is no
data migration of existing users' rights.

### Rejected alternatives

- **Per-user capability overrides.** Ruled out by the requirement itself: visibility is a
  property of the role, not the person. Also carries the onboarding risk phase 1 avoided —
  N toggles to set correctly per account instead of one role choice.
- **Roles as DB rows** (an admin creating `Skladník` in the app). Needs `UserRoleType` →
  `Role` entity, dynamic role claims, and rework of the `Admin` bypass and `RequireRole`
  policies. Deferred: the trigger for a genuinely new role is new capability *gates*, which
  are a code change regardless, so admin-created roles buy little today.
- **Roles carrying module rights as well as components.** Would retire the working per-user
  matrix and require migrating every existing user. Not needed for the stated goal.

### Two tiers of capability

| | Declared in | Adding one costs | Enforcement |
|---|---|---|---|
| **Data-guarding** (own endpoint, prices) | `Capability` enum + frontend registry | backend touch + client regen | server-side 403 **and** hidden |
| **Cosmetic** (already-permitted data, screen noise) | frontend registry only | one registry entry + one `can()` call | hidden in the UI only |

The `role_capabilities.capability_key` column is a string either way. A data-guarding key
must match its `Capability` enum name exactly or its gate silently stops matching, so a test
asserts every `guardsData: true` key in the registry corresponds to a generated `Capability`
value. That drift check is the mechanism; not a rule people are expected to remember.

### Default-allow

A missing row means visible. This preserves phase 1's semantics (`RoleCapabilities` lists
only denials) and means adding a capability cannot accidentally hide it from everyone. A
seed migration writes the three current `Driver` denials, so deploying this is
behaviour-neutral.

`Admin` is never stored and never editable — it short-circuits to all-allowed in both
`CapabilityHandler` and the frontend, as it does today.

## Backend

### Data model

`RoleCapability : BaseEntity` (beside `UserPermission`):

- `role` — `UserRoleType`, string-converted per the global enum convention.
- `capability_key` — string, max 64.
- `is_visible` — bool.
- Unique index on `(role, capability_key)`.

Registered as `DbSet<RoleCapability> RoleCapabilities`, configured in
`Infrastructure/Persistence/Configurations/RoleCapabilityConfiguration.cs`, migration
`AddRoleCapabilities` seeding the `Driver` denials.

### Reading the policy

`CapabilityHandler` reads the table instead of the static class. It must move from
**singleton to scoped** — `AuthenticationExtensions.cs` currently registers it as a
singleton, which cannot hold a scoped `AleTrackDbContext`. It injects the `DbContext` plus
`IMemoryCache` (already registered at `Program.cs:51`); the whole table is one small map
cached under a fixed key, evicted by the write endpoint, so the common path runs no query.

`RoleCapabilities.cs` stops being policy: its values become the migration's seed, and the
class is removed. `RoleCapabilitiesTests` is rewritten against the DB-backed handler.

### Claims

`JwtService` gains `CapabilityClaimType = "cap"` and emits one claim per **hidden** key
(`cap: "invoicing"`), mirroring how `PermissionClaimType = "perm"` already emits
`"Orders:Edit"`. Default-allow means only denials need carrying. `JwtService` takes the same
cached map, so login and refresh both stamp current policy.

### Endpoints

New slice `Features/RoleCapabilities/` with its own `IFeatureConfiguration` and Swagger tag:

| Endpoint | Gate |
|---|---|
| `GET role-capabilities` | `RequirePermission(ModuleType.Users, PermissionLevel.View)` |
| `PUT role-capabilities` | `RequirePermission(ModuleType.Users, PermissionLevel.Edit)` |

`PUT` replaces the whole set — the payload is a handful of rows, so full replacement beats
per-row diffing. Its validator rejects any row whose role is `Admin`, under its own error
code, so a client bug cannot hide something from admins.

## Frontend

### The registry

`src/auth/capabilityRegistry.ts` is the single frontend declaration:

```ts
{ key: 'invoicing', label: 'Fakturace', module: 'shipments', guardsData: true }
{ key: 'loadingBreakdown', label: 'Rozpis nakládky', module: 'shipments', guardsData: false }
{ key: 'money', label: 'Ceny', module: null, guardsData: true }   // null = cross-application
```

The `Capability` union derives from its keys, replacing today's `CAPABILITIES` const. Czech
labels live frontend-side, following `src/lib/labels.ts`.

### Capabilities from the token

`capabilities.ts`'s hardcoded `DENIED_BY_ROLE` **is deleted**. In its place
`capabilitiesFromClaims(roles, capClaims)`: `Admin` → all allowed, otherwise every registry
key allowed except those named in the claims.

It is assembled in `userFromToken` (`src/auth/jwt.ts`) and stored on `CurrentUser` as `caps`,
exactly alongside the existing `perms` — so it is persisted and restored with the session like
every other decoded claim. `AuthProvider.can()` then reads `user.caps` instead of calling a
resolver, and stays synchronous, so no call site changes.

This removes the frontend's mirror of backend policy — one fewer thing to drift.

### The admin screen

Reached from a `Role a komponenty` action in the Uživatelé page header, at `/users/roles`
(`<UsersPage view="roles" />`, matching `/shipments/new`). Deliberately **not** in
`UserFormDrawer`: that drawer edits one user, and role-level toggles there would read as
per-user while changing every driver.

Rows are modules, expandable into their components; columns are the roles:

```
Modul / komponenta        Administrátor   Uživatel   Řidič
▾ Vývozy                      ✓ (grey)       ✓         ✓
    🔒 Fakturace              ✓ (grey)       ✓         ✗
       Rozpis nakládky        ✓ (grey)       ✓         ✗
▸ Napříč aplikací
    🔒 Ceny                   ✓ (grey)       ✓         ✗
```

The lock marks `guardsData` — server-enforced, not merely hidden — because that is exactly
what someone toggling these needs to know. Data comes from `src/hooks/useRoleCapabilities.ts`
with keys from `qk`; the mutation invalidates on success.

The save confirmation states the propagation rule: *Změny se u přihlášených uživatelů projeví
po dalším přihlášení.*

## Propagation

The backend enforces a saved change on the next request (cache evicted). The frontend learns
it when the user's token is next issued — refresh or re-login.

Accepted deliberately, because **module rights already behave exactly this way**: `perm`
claims are stamped at login, so "rights apply on next sign-in" is semantics these users
already live with. Making capabilities fresher than permissions would be an inconsistency,
not an improvement.

The visible window for a data-guarding capability is: card still rendered, endpoint already
403s — surfaced by `apiErrorMessage` as a Czech error, not a crash. For a cosmetic capability
there is no visible effect at all.

## Testing

- `CapabilityHandler` against the DB: visible row, hidden row, missing row (allowed), `Admin`
  bypass, and that a saved change is picked up after cache eviction.
- `PUT` validator: rejects `Admin` rows with the right error code; rejects an empty or
  over-long key.
- Both endpoints' permission gates.
- **The registry drift test**: every `guardsData: true` key matches a generated `Capability`
  value. This is the one guarding silent un-gating.
- `capabilitiesFor` from claims: admin bypass, denial from claims, unknown claim key ignored.
- The admin screen: renders module groups with their components, greys the `Admin` column,
  and sends the full set on save.

## Verification

- `dotnet-verify` for `api/**`, `react-verify` for `app/**`.
- Backend and frontend land in the same commit: `Capability` and the new DTOs cross the
  OpenAPI boundary, so `yarn generate-api` is part of the work.

## Out of scope

- **Per-user capability overrides** — ruled out above, and still ruled out.
- **Admin-created roles** (`UserRoleType` → DB entity) — deferred, see rejected alternatives.
- **Roles carrying module rights** — deferred; the per-user matrix stays.
- **A fresh `GET me/capabilities`** making the frontend immediately consistent. It would make
  `can()` async and force a pending state into every gated component. Revisit only if the
  on-next-sign-in window proves to be a real problem in use.
- **Linking a `User` to a `Driver` entity** so a driver sees only their own vývozy. Still the
  separately agreed next step; row-level filtering, a different mechanism from capabilities.
