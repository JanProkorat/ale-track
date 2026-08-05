# Shipment start point, company stop, and the driver's unload view

Date: 2026-08-04
Branch: `feat/shipment-start-point-and-unload-view`

## Problem

Three gaps in the same journey — planning a run and then driving it.

**A run does not start at the depot.** `RouteMap` hardcodes the company address as
both start and end of every route. In reality the van is loaded at a brewery and
only comes home at the end. The map, the distance estimate, and the
nearest-neighbour optimizer all measure from the wrong origin.

**There is no way to put the company on the route.** "Zboží na sklad" — goods
bought from the brewery for our own warehouse — has to be dropped off somewhere,
and that somewhere is the company. The custom-stop dialog can only take a typed
address or a map click, so the planner retypes the company address by hand, and
nothing in the data says "this stop is the warehouse".

**The nakládka is loading order, not unloading order.** The Celková nakládka card
aggregates per product and sections by brewery — exactly right at the ramp, where
the pallet is packed brewery by brewery. It is the wrong shape on the road, where
the driver needs "at stop 3, take these off". The Vše/F1/F2 tabs all show the same
loading shape.

## What we are building

1. The company address moves from a frontend env var to backend configuration, and
   a new endpoint serves the pickable start points (company + breweries).
2. A shipment stores its start point: the company, or one of the breweries.
3. A third stop kind, `Company`, so the warehouse stop is a first-class thing the
   server can reason about — and it keeps itself in sync with the stock purchases.
4. A read-only **Vykládka** tab on the nakládka card: stops in route order, each
   with what comes off the van there.

## Decisions and why

**Start point is `kind + brewery FK`, not a snapshotted point.** Storing
label/lat/lng directly would mean a corrected brewery address never reaches a
planned run. The FK keeps planning data live; history is already served by the
snapshotting the stops do at load time.

**The company address lives in backend `appsettings.json`, not the frontend env.**
Three consumers now need it — the picker, the Company stop's coordinates, and the
map's end marker. Two copies in two config systems would drift. The address is a
public business address, not a secret, so it belongs in the committed baseline
rather than `appsettings.Development*.json`.

**`OutgoingShipmentStopKind.Company` rather than a pre-filled custom stop.** A
custom stop the planner happened to name "Sklad" is indistinguishable from the real
thing, which breaks both the auto-sync (duplicate stops) and the Vykládka view
(it could not know to list the stock purchases there). The enum is persisted as a
string, so the new member costs no column change.

**The stock-purchase ⇄ Company-stop sync is enforced server-side.** The rule is an
invariant of the shipment, and it has two write paths (the detail screen's nakládka
toggles and the editor's route save). One place in the update/create endpoints
cannot be bypassed or fall out of step. The trade this makes is spelled out under
*Consequences* below.

**Vykládka is a view swap, not a filter.** Vše/F1/F2 filter the same aggregated
table; the driver view has a different shape entirely (per stop, not per product;
no brewery sections; no invoice columns). It renders a different component rather
than reusing `AggLoadingTable` with a filter.

## Backend

### Configuration

`appsettings.json` gains a `Company` section — name, street, street number, city,
zip, country, latitude, longitude. Bound as `CompanyOptions` via
`services.Configure<CompanyOptions>(...)` in `Program.cs`, alongside the existing
`JsonOptions`/`HealthCheckServiceOptions` binding. (This repo does not use the
`IFeatureConfiguration` pattern from the generic dotnet pack — options are bound in
`Program.cs`.)

### Schema

```
outgoing_shipments
  + start_point_kind   ShipmentStartPointKind   (Company | Brewery), existing rows -> Company
  + start_brewery_id   bigint null, FK -> breweries, DeleteBehavior.Restrict
```

New enum `AleTrack.Common.Enums.ShipmentStartPointKind { Company = 0, Brewery = 1 }`.
`OutgoingShipmentStopKind` gains `Company = 2`; persisted as a string, so no column
change.

One migration, `AddOutgoingShipmentStartPoint`. Review the generated SQL for the FK
and the backfill default before committing.

`Restrict` on the FK, not cascade: deleting a brewery that a planned run starts from
should fail loudly rather than silently delete the run.

### New slice: `Features/OutgoingShipments/Queries/StartPoints/`

`GET outgoing-shipments/start-points`, permission `ModuleType.Shipments` /
`PermissionLevel.View`, matching the sibling endpoints' shape (`public sealed`,
`Description(b => b.RequirePermission(...).Produces<...>().WithName(...))`,
`DontCatchExceptions()`, `Summary`).

```csharp
public sealed record ShipmentStartPointDto
{
    public ShipmentStartPointKind Kind { get; set; }
    public Guid? BreweryId { get; set; }     // null for the company entry
    public string Name { get; set; } = null!;
    public string Address { get; set; } = null!;   // one formatted line
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
}
```

Company entry first, then breweries ordered by `DisplayOrder` then `Name` — the same
order the catalogue uses. Brewery coordinates come from `Brewery.OfficialAddress`;
a brewery with no coordinates is still listed (it is a valid choice) with null
lat/lng, and the map simply cannot plot it.

### DTO changes

- `OutgoingShipmentDetailDto` — `StartPointKind`, `StartBreweryId`, and the resolved
  `StartPointName` / `StartPointAddress` / `StartPointLatitude` / `StartPointLongitude`,
  so the detail screen needs no second request to draw the map.
- `CreateOutgoingShipmentDto`, `UpdateOutgoingShipmentDto` — `StartPointKind`,
  `StartBreweryId`.
- `CustomStopDto` — `Kind` (`Custom` | `Company`), defaulting to `Custom` so an
  existing payload keeps its meaning.
- `OutgoingShipmentStopDto` already carries `Kind`, server-side and in the generated
  client. No change; the frontend simply starts reading it instead of inferring
  order-vs-custom from `orderId != null`.

### Validation

Validator rules (FluentValidation, `Validator<T>`, every rule with
`.WithErrorCode(...)` per the repo's convention):

- `StartBreweryId` required when `StartPointKind == Brewery`, and must be null
  otherwise.
- The referenced brewery must exist — endpoint-level, not validator-level (it is
  domain state, not input shape): unknown id → `Send.NotFoundAsync`.
- At most one `Company` stop in `CustomStops`.
- A `Company` stop's `Label` is not required from the client; the server fills name
  and coordinates from `CompanyOptions` so a stale client cannot pin the warehouse
  to the wrong point.

The start point locks with the stop structure — a shipment past `Created` refuses a
change, the same rule `ShipmentMutability` already applies to stop composition.

### The Company-stop invariant

Applied in the create and update endpoints, after the stops are written and before
save:

- stock purchases exist, no `Company` stop → append one at `max(order) + 1`, name and
  coordinates from `CompanyOptions`
- stock purchases exist, a `Company` stop already exists → **leave it where it is**
- no stock purchases, a `Company` stop exists → remove it

The middle rule is the point: a run may legitimately call at the warehouse mid-route
(unload our goods, then carry on to Germany, then home), and the planner's ordering
must survive every unrelated save.

Extracted as a small unit in `Features/OutgoingShipments/Utils/` — the ordering
arithmetic is worth testing without an endpoint around it, like
`ShipmentInvoiceReconciler` next to it.

**Consequences.** Deleting the HQ stop in the editor while goods are still on the
nakládka will not stick — the save puts it back. That follows directly from the
add/remove sync rule, and the way out is to remove the goods. The editor should not
pretend otherwise; see the frontend note below.

The second consequence is about the *address*, not the stop. `BuildCustomStops`
authors a Company stop's label and coordinates from the *current* `CompanyOptions`,
while `ShipmentContentGuard.CustomStopsMatch` normalizes the incoming side through
the *stored* values. So correcting the configured company address silently rewrites
a frozen shipment's Company stop on its next save, and the freeze does not report it
as a content change. That is deliberate: comparing against live configuration
instead would make every frozen shipment carrying a Company stop permanently
unsaveable the moment the address is corrected — no state advance, no delivery. A
warehouse that moved is a fact about the company, not a change to the planner's
route, so the run picks up the new address and keeps going. Do not "fix" the
normalizer without reading this paragraph first.

## Frontend

The backend change and its consumption land in the same commit, per the repo's
codegen rule — `yarn generate-api` against a locally running backend.

### `src/lib/geo.ts` and `RouteMap`

Delete `DEPOT`, `readDepot()`, the `VITE_COMPANY_ADDRESS` declaration in
`vite-env.d.ts`, its `env.example` line, and its `vitest.config.ts` stub.

`RouteMap` takes `start` and `end` props (`{ lat, lng, name, address? }`) instead of
importing `DEPOT`. `end` is always the company — the run comes home — and both
callers read it off the start-points query's company entry. `start` is the shipment's
resolved start point on the detail screen (already on the detail DTO, no second
request) and the currently picked one in the editor.

`geo.test.ts` currently covers `readDepot`'s parsing; those cases go with the
function. The remaining geo tests are unaffected.

### Data

`useShipmentStartPoints()` in `src/hooks/useShipments.ts`; key
`qk.shipmentStartPoints` added to `src/api/queryKeys.ts` next to `shipmentOrders`
(same hand-written nested-resource style). It is reference data — a long
`staleTime` is appropriate.

### Editor — the start-point card

A "Výchozí bod" card directly above "Pořadí zastávek", holding a single select over
the start points (Firma first, then breweries), defaulting to Firma. It drives:

- the map's start marker,
- the nearest-neighbour optimizer's origin — currently seeded from `DEPOT` at
  `ShipmentEditor.tsx:467`, and the reason the suggested order is wrong today,
- the saved `StartPointKind` / `StartBreweryId`.

It joins the unsaved-changes snapshot (`serializeShipment`) and is disabled when
`structureLocked`.

The editor's stop list renders a `Company` stop with its own icon and label, not
draggable-into-nonexistence: it may be reordered like any other stop, but the delete
button carries a tooltip explaining it will come back while goods are on the
nakládka. Better than silently undoing the planner's click.

### `CustomStopDialog` — the company option

A two-way toggle at the top: *Vlastní místo* / *Firemní sklad*. Company mode hides
the map picker and the name/note fields and shows the company address read-only;
confirming returns a Company-kind stop. The option is disabled, with a hint, when
the route already has one.

`onAdd`'s payload gains a discriminator so the caller knows which kind came back.

### Detail — the Vykládka tab

`filterOptions` gains a fourth entry, `{ value: 'unload', label: 'Vykládka' }`, after
the invoice columns. When it is active the card renders `UnloadOrderList` in place of
`AggLoadingTable`; the progress pills and the two header buttons stay, and the
invoice header/footer cells are simply not part of that component.

Per `app/CLAUDE.md`'s >500-line rule (and `ShipmentDetail.tsx` is already ~1720),
the shaping is a pure sibling module:

```ts
// src/features/shipments/unloadOrder.ts
export interface UnloadLine { name: string; chip: string; quantity: number }
export interface UnloadStop {
  seq: number;                     // 1-based position on the route
  kind: 'order' | 'custom' | 'company';
  title: string;                   // client name, custom label, or "Firma"
  subtitle?: string;               // resolved address line
  note?: string;
  lines: UnloadLine[];
}
export function unloadOrder(
  stops: OutgoingShipmentStopDto[],
  stockPurchases: OutgoingShipmentStockPurchaseItemDto[],
): UnloadStop[]
```

Stops sorted by `order`; each stop's lines from `stop.products`, which the detail
endpoint projects from the live `ClientOrder.OrderItems` — so the view is populated
while the run is still `Created`, not only after loading snapshots the stop items.
The Company stop's lines come from `stockPurchases`. Addresses resolve through the
existing `resolveDetailStopAddress`.

The start point is deliberately *not* an `UnloadStop`: nothing is unloaded there, and
making it stop 0 would put it in the numbering. `UnloadOrderList.tsx` takes it as its
own prop and renders it as a header line above the numbered blocks. Custom stops with
no goods still get a block — a fuel stop is part of the drive.

## Testing

Backend (xUnit + FluentAssertions + Moq.EntityFrameworkCore, no DB):

- start-points endpoint: company entry first, breweries in display order, a brewery
  with no coordinates still listed
- validator: brewery id required iff kind is Brewery; two Company stops rejected
- start point rejected on a shipment past `Created`
- the invariant unit, four cases: adds when goods appear, leaves an existing stop's
  position alone, removes when the last goods go, no-op when neither applies
- unknown brewery id → 404

Frontend (Vitest, `fireEvent` — `user-event` is not a dependency):

- `unloadOrder`: route order, a Company stop carrying the stock purchases, a custom
  stop with no lines, an empty shipment
- `ShipmentDetail`: the Vykládka tab swaps the table for the list; the invoice
  footers are gone while it is active
- `CustomStopDialog`: company mode hides the picker and returns a company stop; the
  option is disabled when one exists
- `ShipmentEditor`: picking a start point marks the form dirty and is disabled when
  locked

Verification is `dotnet-verify` for `api/**` and `react-verify` for `app/**` — both,
since this work item touches both.

## Out of scope

- **The Excel/Word export.** It keeps its per-client sheets and gains no driver-order
  page. Worth revisiting once the view has been used on a real run.
- **Per-stop unload check-off.** Considered and dropped: it needs new persisted state
  and an endpoint on top of everything here. The view is read-only.
- **Multiple loading points.** One start point per run. A route loading at two
  breweries is expressible today as a custom stop at the second.

## Risks

- **The migration is not revert-by-commit.** Two added columns and an FK; applying it
  is its own operation. The backfill (existing rows → `Company`) reproduces today's
  behaviour exactly, so a deployed-but-unused column is harmless.
- **Removing `DEPOT` touches every route-drawing surface.** `RouteMap` is shared by
  the editor and the detail screen; both must pass the new props or the map silently
  loses its endpoints. The typecheck catches it — the props are required, not
  optional with a fallback, deliberately.
- **`yarn generate-api` needs the backend on :8080**, and picks up whatever is
  listening there. Confirm the running instance is this branch's before regenerating.
