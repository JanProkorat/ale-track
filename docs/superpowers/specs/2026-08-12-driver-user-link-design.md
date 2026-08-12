# Driver ↔ User link and row-level scoping

**Date:** 2026-08-12
**Status:** Approved, ready for planning
**Branch:** `feature/driver-user-link`

## Problem

The `Driver` role exists and hides *content* — the Fakturace section, the loading
breakdown, money — through the role-capability layer shipped on 2026-08-11
(`2026-08-10-role-based-content-visibility-design.md`,
`2026-08-11-role-capability-configuration-design.md`). That layer never filters
rows. A driver account today reads every shipment and every driver record in the
system.

This is the agreed step 2: link a `User` to a `Driver` so a driver account sees
only itself in Řidiči and only the vývozy it is assigned to. Row-level filtering
is a different mechanism from capabilities and does not reuse them.

## Decisions

| Question | Decision |
|---|---|
| Where is the link edited? | The Uživatelé drawer, via a picker shown when role = Driver |
| Which entity owns the FK? | `Driver.UserId` — `User` stays free of module dependencies |
| Unlinked driver account sees? | Nothing, with an explanatory empty state (fail-closed) |
| Scoping breadth | Řidiči + Vývozy only. Dovozy and Reporty are handled by not granting those module permissions |
| What may a driver edit on themselves? | Every field — jméno, příjmení, telefon, barva, dostupnost |
| Enforcement mechanism | Explicit `IDriverScope` resolver called per endpoint |
| Shipment write commands | `Create`/`Delete` forbidden; `Update`, `AcknowledgeAddressChanges`, `SetPreparationStep`, `SetLoadingState` gated to assigned shipments |

### Rejected alternatives

**EF Core global query filters keyed off a JWT claim.** Impossible to forget, but
the filter becomes invisible at the call site, applies silently to the seeder,
exports and every test, and forces `IgnoreQueryFilters()` escapes on admin
queries. The codebase has no global query filters today. A claim also goes stale:
re-pointing a link would not take effect until the user signs in again.

**Modelling the scope as a capability.** Capabilities are boolean content hiding;
the row-filtering code still has to be written either way, so this only adds a
knob that can silently switch a security control off. Per-role overrides for
driver scoping were already rejected when the capability layer was designed.

## Data model

`Driver` gains:

- `long? UserId` mapped to `user_id`, FK → `users.id`, `DeleteBehavior.SetNull`.
- `User? User` navigation.
- A unique index on `user_id`. Postgres treats NULLs as distinct, so unlinked
  drivers do not collide while a linked user can own at most one driver record.

`SetNull` means deleting a user account releases the driver record rather than
deleting a person from the fleet.

The link lives on `Driver` even though it is *edited* from the user drawer: it
keeps `User` free of a module-specific dependency, and every scoping query starts
from "which driver is this caller", a direct indexed lookup on that column.

**Migration `AddDriverUserLink`** — one column, one FK, one unique index, no data
change. Migrations are not auto-applied on startup in this repo, so it must be
applied manually before the branch is usable, and **every existing driver account
goes dark until an admin links it** (the fail-closed rule). That is expected, not
a defect.

## DTO surface

- `CreateUserDto` / `UpdateUserDto` gain `Guid? DriverId` (the driver's `PublicId`).
- `UserListItemDto` gains `Guid? DriverId` and a `DriverName` string, so the users
  table shows the link without a second fetch.

Validation on both write paths. Per `rules/validation.md` the two levels stay
separate — input shape in the validator, domain state in the endpoint:

| Rule | Level | Error code |
|---|---|---|
| `DriverId` must be null unless `UserRoles` contains `Driver` | Validator | `UserErrorCodes.DriverLinkRequiresDriverRole` |
| The referenced driver must exist | Endpoint → 404 | `ErrorCodes.NotfoundError` |
| The driver must not already belong to a different user | Endpoint → 400 | `ErrorCodes.DriverAlreadyLinkedToUser` |

## Backend enforcement

### The resolver

New `IDriverScope` / `DriverScope` in `Common/Utils/`, registered scoped, next to
the existing `IAppContext` it depends on. It qualifies as `Common/` under the
"reused by 2+ features" rule and follows the `IAppContext` precedent — it is not
a feature-logic service class.

```csharp
public interface IDriverScope
{
    /// True when the caller's roles contain Driver and not Admin.
    bool IsScoped { get; }

    /// The linked Driver.Id, or null when the account has no driver record.
    Task<long?> GetDriverIdAsync(CancellationToken ct);
}
```

`IsScoped` reads claims only, so the common (non-driver) case costs nothing.
`GetDriverIdAsync` performs one indexed lookup and memoizes it for the request,
so re-pointing a link takes effect on the next request rather than the next
sign-in. Admin short-circuits to unscoped, mirroring `CapabilityHandler`.

### Řidiči

| Endpoint | Behaviour for a driver-scoped caller |
|---|---|
| `GetDriversListEndpoint` | `.Where(d => d.Id == driverId)`; unlinked → empty list |
| `GetDriverDetailEndpoint` | 404 for any id but their own |
| `UpdateDriverEndpoint` | 404 for any id but their own; all fields editable on their own |
| `CreateDriverEndpoint` | 403 |
| `DeleteDriverEndpoint` | 403 |

Detail and update return **404**, not 403, so a driver cannot probe which driver
ids exist. An unlinked driver-scoped caller matches no id, so every id-based
endpoint in both features 404s for them — the same fail-closed result the list
endpoints give by returning nothing. Delete is forbidden for driver-scoped callers outright rather than
special-casing self — drivers do not delete driver records at all, which
satisfies "cannot delete themselves" without a separate rule.

### Vývozy

Reads — `GetOutgoingShipmentsListEndpoint` gains
`.Where(os => os.Drivers.Any(x => x.DriverId == driverId))` (unlinked → empty);
`GetOutgoingShipmentDetailEndpoint` and both export endpoints 404 on an
unassigned shipment.

Writes — `CreateOutgoingShipmentEndpoint` and `DeleteOutgoingShipmentEndpoint`
403 for driver-scoped callers. `UpdateOutgoingShipmentEndpoint`,
`AcknowledgeAddressChangesEndpoint`, `SetPreparationStepEndpoint` and
`SetLoadingStateEndpoint` 404 on an unassigned shipment. Without these, a driver
would see one shipment in the UI while still being able to `PUT` any shipment id
directly.

The invoicing commands need no change — `RequireCapability(Invoicing)` already
403s them for drivers.

## Frontend

The backend DTO change requires `yarn generate-api` against a locally-running
backend in the same commit.

`useAuth()` gains `isDriverScoped`, derived as `roleOfRoles(user.roles) === 'Driver'`.
That is not new logic: `roleOfRoles` already resolves Driver over Manager and
Admin over everything, matching the backend's `IsScoped` rule exactly, so the two
sides cannot drift.

**Uživatelé.** `UserFormDrawer` gains a `Combobox` labelled *Řidič*, rendered only
when the role radio is `Driver` and fed by `useDrivers()`. Switching the role away
from Driver clears the selection, so an orphaned link cannot reach the validator.
The hint under the role radio gains a line about the link. `UsersPage` shows the
linked driver's name in the row.

Drivers already claimed by another account are **filtered out** of the options
(the account's own current driver always stays), with helper text under the
picker reading *"Řidiči, kteří už mají účet, se v nabídce nezobrazují."* The
shared `Combobox` has no per-option disabled state, and adding one would change a
component with ~20 call sites for this feature's benefit alone.

**Řidiči.** For a driver-scoped user, the "Přidat řidiče" button and every row's
delete action are hidden. The backend 403s regardless, but `app/CLAUDE.md`
requires gating the control as well as the route.

**Empty states.** When a driver-scoped user has no link, both the Řidiči list and
the Vývozy list render:

> Účet zatím není propojen s řidičem — kontaktujte správce.

so an unlinked account explains itself instead of looking broken.

All new copy is Czech; all code and comments are English.

## Testing

Backend unit tests against the mocked `DbContext`, named
`{Method}_{StateUnderTest}_{ExpectedBehavior}`:

- `HandleAsync_DriverScopedCallerNotAssigned_Returns404` per gated shipment endpoint.
- `HandleAsync_DriverScopedCaller_Returns403` for driver create/delete and shipment create/delete.
- `HandleAsync_DriverScopedCallerUnlinked_ReturnsEmptyList` for both list endpoints.
- `HandleAsync_AdminCaller_ReturnsAllRows` on both lists, pinning the Admin bypass.
- Validator tests for the three new user error codes.

The unlinked-returns-empty tests carry the most weight: they pin the fail-closed
default, the requirement most likely to be "simplified" into fail-open later.

Frontend tests follow the existing `vi.mock` convention with loading, error and
no-data cases, covering the role→picker visibility and the clear-on-role-change
behaviour.

## Known gaps

**A future shipment query could forget the resolver.** It is called explicitly per
endpoint, which is the trade-off of choosing an explicit resolver over global
query filters. Tests cannot catch code that does not exist yet.

**`SetLoadingStateEndpoint` has no `RequireCapability(LoadingBreakdown)`** even
though the loading breakdown is capability-hidden in the UI. Pre-existing, a
different mechanism, and out of scope here — it wants its own task.

**Dovozy and Reporty stay unscoped.** A driver account is expected to have those
modules at *bez přístupu* in the permission matrix. If drivers are ever given
access to Dovozy, that module needs the same treatment.
