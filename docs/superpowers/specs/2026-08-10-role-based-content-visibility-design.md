# Role-based content visibility — the `Driver` persona

**Date:** 2026-08-10
**Status:** approved design, not yet implemented

## Problem

Drivers recorded in the `Řidiči` module need accounts in the app so they can read
their vývoz on a phone. The obvious setup — role `User`, `Shipments: View` — gives
them the whole shipment detail page: the `Vše` / `F1` / `F2` loading-breakdown tabs
and the full `Fakturace` section with every price on it.

The permission system's only axis is *module × level* (`none` / `view` / `edit`).
It can hide a whole module but has no way to hide a region **inside** a page, so
there is nowhere for "a driver sees the Vykládka table and nothing else" to live.

Concretely, for the shipment detail page a driver must see:

- the stop-by-stop `Vykládka` view — and not the `Vše` / `F1` / `F2` tabs over the
  aggregated loading table;
- no `Fakturace` section, and no access to the price data behind it.

## Decision: a `Driver` role, consumed through named capabilities

`UserRoleType.Driver` joins `Admin` and `User` as a third role. The users screen
offers the three as a single choice, but nothing on the backend enforces
exclusivity — which is why capability resolution uses the deny-if-any rule below
rather than assuming one role per account. `Driver` grants nothing on its own — the permission matrix still does that. A driver
account is `Driver` + `Shipments: View`, exactly like a `User` account today.
Roles are stored as strings in `user_roles` and already ride in the JWT as role
claims, so there is **no schema change**.

### Why a role rather than finer-grained permission keys

The requirement is not "this user shouldn't see invoicing" — it is "this person is
a driver in the field", which implies a bundle of consequences that will grow
(no invoicing, no loading aggregation, later probably no margins, no client
contacts). Modelled as sub-module permission keys (`ShipmentsInvoicing`,
`ShipmentsLoading`, …) the office would have to set several matrix rows correctly
for every driver onboarded, and one mis-set row leaks prices. As a role it is one
choice at account creation, and the meaning of "driver" lives in one place in code
instead of scattered across per-user data.

It also matches what already exists: `UserRoleType`, `RequireRole`, and role claims
in the JWT all work today, and `Admin` already means "bypass the matrix". A role
that *narrows* is the symmetric idea. The matrix grants; the role subtracts.

Alternatives considered and rejected:

- **Sub-module permission keys** — composes better and reuses the whole existing
  pipeline, but pushes per-driver configuration risk onto the office, and multiplies
  the rows in the users screen matrix.
- **A `PermissionLevel.Limited` below `View`** — no new modules needed, but the
  meaning of "Limited" would differ per module, making it impossible to explain in
  the users screen and impossible to compose.

### The capability layer

What `Driver` *means* is expressed once, as a capability set resolved from the role.
Components ask about capabilities, **never** about the role.

| Capability | `Admin` | `User` | `Driver` |
|---|---|---|---|
| `Invoicing` — the Fakturace section and its data | ✓ | ✓ | ✗ |
| `LoadingBreakdown` — the `Vše` / `F1` / `F2` aggregation tabs | ✓ | ✓ | ✗ |
| `Money` — any price, anywhere | ✓ | ✓ | ✗ |

`useAuth()` gains `can(capability)` beside `canSee(module)` / `canEdit(module)`.
The point of the indirection: when a second persona appears (warehouse staff who
need loading but not billing), one table changes instead of hunting role checks
through components.

`Money` is not consumed on the shipment detail page — that DTO carries no prices
(see below) — but it is the hook future asks will hang off, so it ships with the
initial set rather than being retrofitted.

**Capabilities derive from the role only. There is no per-user override.** The
moment "this driver *may* see invoicing" becomes tickable, the matrix has been
rebuilt with more rows and the safety argument for the role is gone. If that need
turns out to be real, it is a second role, not a checkbox.

Resolution rule on both sides: `Admin` short-circuits to all-allowed; otherwise
**deny if any of the caller's roles denies**. An account that somehow carries
`Driver` alongside another role lands on the restrictive answer.

## Where the money actually is

`OutgoingShipmentDetailDto` contains no money at all — its only `decimal` fields
are `StartPointLatitude` / `StartPointLongitude` and the per-stop `Latitude` /
`Longitude`. Every price on the shipment detail page arrives through the separate
`GET outgoing-shipments/{id}/invoices` call that `ShipmentInvoicing` makes on its
own.

This is what makes the cheap approach also the secure one: closing one read
endpoint covers the money, with no field-stripping pass over a large DTO.

## Backend

Mirrors the existing `ModulePermissionRequirement` pattern, so there is one shape
to learn rather than two.

```
Common/Enums/Capability.cs                     → { Invoicing, LoadingBreakdown, Money }
Common/Authorization/CapabilityRequirement.cs  → PolicyName(cap) => "cap:Invoicing"
Common/Authorization/CapabilityHandler.cs      → Admin passes; else fail if any of the
                                                 caller's roles denies the capability
```

The role→capability map is a static table on the backend and is **the** authority;
the frontend copy drives chrome only.

Registration loops `Enum.GetValues<Capability>()` inside `AddUserAuthorization`
(`Common/Utils/AuthenticationExtensions.cs`), alongside the existing module×level
loop. `RequireCapability(Capability)` joins `RequirePermission` in
`Common/Utils/EndpointDefinitionExtensions.cs`; ASP.NET ANDs multiple policies, so
the two compose with no special handling.

### Endpoints that change

| Endpoint | Current | Add |
|---|---|---|
| `GetShipmentInvoicesEndpoint` | `Shipments: View` | `RequireCapability(Invoicing)` |
| `AddShipmentInvoiceEndpoint` | `Shipments: Edit` | `RequireCapability(Invoicing)` |
| `DeleteShipmentInvoiceEndpoint` | `Shipments: Edit` | `RequireCapability(Invoicing)` |
| `MoveInvoiceLineEndpoint` | `Shipments: Edit` | `RequireCapability(Invoicing)` |
| `AddPurchaseInvoiceEndpoint` | `Shipments: Edit` | `RequireCapability(Invoicing)` |
| `DeletePurchaseInvoiceEndpoint` | `Shipments: Edit` | `RequireCapability(Invoicing)` |
| `SetPurchaseInvoiceLineEndpoint` | `Shipments: Edit` | `RequireCapability(Invoicing)` |

`GetShipmentInvoicesEndpoint` is the actual leak: it requires only `Shipments: View`,
which every driver holds, so without this change a driver's browser can fetch the
full price breakdown no matter what the UI renders.

The six `Edit`-level commands are already unreachable for a view-only driver. They
get the capability anyway because that safety rests entirely on drivers never
holding `Shipments: Edit` — and `SetLoadingStateEndpoint` and
`SetPreparationStepEndpoint` also require `Edit`. The first time a driver needs to
tick off a loaded pallet, they need `Edit`, and without the capability gate all six
commands would open in the same move. Cheap insurance against a change nobody would
connect to invoicing.

### Endpoints that deliberately do not change

- `GetOutgoingShipmentDetailEndpoint` — no money in the DTO; drivers need all of it
  for the unload view.
- `ExportOutgoingShipmentWordEndpoint` / `ExportOutgoingShipmentExcelEndpoint` — no
  prices either (the only `decimal` mention in `ShipmentExportLabels.cs` is weight
  formatting). The loading sheet is arguably a driver's most useful artifact.
- `CreateUserEndpoint` / `UpdateUserEndpoint` — `CreateUserValidator` only asserts
  `UserRoles` is non-empty, so the new enum value flows through unchanged.

### A stated asymmetry

`Invoicing` and `Money` are real security boundaries. **`LoadingBreakdown` is not** —
the `F1` / `F2` tabs aggregate quantity data drivers legitimately receive for the
unload view, and it has no server-side counterpart. It is a UI-tidiness capability.
Written down here so nobody later assumes it protects something.

## Frontend

Two things already work in this design's favour: the sidebar is built from the
permission matrix, and `ShipmentsPage.tsx` already gates the order link on
`canSee('orders')`. A driver holding only `Shipments: View` gets `Nástěnka` +
`Vývozy` and nothing else, with **no nav changes**.

- **`src/auth/jwt.ts`** — widen the role union to include `'Driver'`. Today the
  claim filter accepts only `'Admin' | 'User'`, so a `Driver` token decodes to
  `['User']` and every capability check passes: the feature would **fail open**.
  The `roles.length ? roles : ['User']` fallback stays for genuinely claim-less
  tokens.
- **`src/auth/capabilities.ts`** (new) — the `Capability` union, the role→capability
  table mirroring the backend's, and `capabilitiesFor(roles)` implementing the
  deny-if-any-denies rule.
- **`src/auth/AuthProvider.tsx`** — resolve once from `user.roles`; expose
  `can(capability)`.
- **`src/features/shipments/ShipmentDetail.tsx`** — when `!can('loadingBreakdown')`
  the `SegControl` does not render at all (a one-option toggle is worse than none)
  and the card renders `<UnloadOrderList>` directly, with `activeFilter` pinned to
  `UNLOAD_VIEW` so the aggregation path never runs. When `!can('invoicing')` the
  `<Box sx={{ mt: 2.5 }}>` wrapping `<ShipmentInvoicing>` is skipped entirely —
  wrapper included, so no orphan margin is left behind.
- **`src/features/users/UserFormDrawer.tsx`** — the binary `isAdmin` checkbox becomes
  a three-way role choice (`Admin` / `Uživatel` / `Řidič`). The matrix stays enabled
  for `Řidič`, since a driver still needs `Shipments: View` granted; only `Admin`
  keeps sending `permissions: []`.
- **`src/features/users/UsersPage.tsx`** — a `Řidič` badge alongside the existing
  admin one.

### What a driver keeps on the shipment detail page

Everything not listed above: the header, stops and map, the `Vyložit` / `Doložit`
garage cards, `ReturnsCard` (vratky are the driver's own job), and
`PreparationStepsCard` read-only. `OrdersOverviewCard` self-hides its links when the
driver lacks `Orders`. Confirmed with the user: nothing further to hide for now.

## Testing

- `capabilitiesFor` per role, including the multi-role case (deny wins).
- **A `jwt.ts` test asserting a `Driver` role claim survives parsing** — this guards
  the fail-open path and is the single most important test here.
- `ShipmentDetail`: no `SegControl` and no `Fakturace` section for a driver; both
  present for a plain `User`. Per `app/CLAUDE.md`, use `waitForElementToBeRemoved`
  if the assertion follows a toggle rather than a fresh mount.
- Backend: `CapabilityHandler` unit tests (Admin bypass, driver denial, unknown role);
  a test that a driver principal is refused by `GetShipmentInvoicesEndpoint`.

## Verification

- `dotnet-verify` for `api/**`.
- `react-verify` for `app/**`.

The frontend and backend halves must land in the same commit — `UserRoleType` and
`Capability` cross the OpenAPI boundary, so `yarn generate-api` is part of the work.

## Out of scope

- **Linking a `User` to a `Driver` entity** so a driver only sees their *own*
  vývozy. That is row-level filtering rather than content hiding, and folding it in
  would roughly double this design. Until it exists, a driver account can read every
  shipment.
- Per-user capability overrides (see the decision above).
- Any driver-specific write capability — e.g. letting a driver confirm an unloaded
  stop. That needs `Shipments: Edit`, which is exactly why the invoicing commands
  are capability-gated here.
