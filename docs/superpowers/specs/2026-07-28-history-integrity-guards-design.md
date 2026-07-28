# History integrity guards (issue #25, parts A and B)

**Date:** 2026-07-28
**Status:** design approved, ready to plan
**Issue:** [#25](https://github.com/JanProkorat/ale-track/issues/25)
**Companion:** `2026-07-28-shipment-content-snapshots-design.md` (the problem
write-up; part C, the snapshot work, stays there)

## Scope

Issue #25 describes five surfaces. This spec covers two of the three groups they
fall into:

| Group | Surfaces | Status |
|---|---|---|
| **A** — stop the data loss | 5 (product delete cascade) | this spec |
| **B** — freeze closed records | 4 (shipment editable in every state), 3 (delivered orders editable) | this spec |
| **C** — snapshot content | 1 (invoice prices read live), 2 (report lines read live) | deferred, own spec |

A and B are self-contained and independently testable. B is the stated
precondition for C: snapshotting content at a state transition achieves nothing
if the content can be edited afterwards.

Part C is deferred because it carries a new owned table, a migration with a
backfill decision for rows predating the snapshot columns, a `HistoryBuilder`
rework, and a frontend regeneration — and because its central question (whether
`DeliveredLineQuery` should read snapshots, changing the meaning of existing
report output) deserves its own design pass.

## Corrections to the issue

The #25 write-up was made from the backend alone. Three of its stated rules
contradict shipped frontend behaviour, and the frontend is right in each case.

| #25 says | Frontend does | Resolution |
|---|---|---|
| `DeliveryDate`, `VehicleId`, `DriverIds` all freeze at `Loaded` | `ShipmentEditor.tsx:274-278` locks order composition and vehicle only — "only drivers (and name/date) may still change" | Follow the frontend. Composition and vehicle freeze; name, date and drivers stay mutable. |
| Forward-only, `Delivered` terminal | `ShipmentDetail.tsx:748-752` has a one-step revert map **including `Delivered → InTransit`** | Keep reverts between the active states. Make `Delivered` terminal — that is the transition that unwinds invoiced, reported history. |
| `Cancelled` is terminal | `ShipmentDetail.tsx:929-930` offers a restore button `Cancelled → Created` | Keep the restore. `Cancelled` is terminal for *content*, not for state. |

A fourth item the issue misses: it marks `ClientOrderShipments` frozen, but that
payload also carries `QuantityFromInventory` and the loading confirmations, which
`ShipmentDetail.tsx:644` deliberately keeps editable through `Loaded` and
`InTransit` — matching the backend's own `IsEditable`. Freezing the field
wholesale would break the nakládka. Content and loading progress travel in the
same DTO field and must be split.

### Two defects worse than described

**Editing an order deletes its invoice lines.** `UpdateOrderEndpoint.cs:101` does
`order.OrderItems.Clear()` and re-adds brand-new `OrderItem` entities on every
save. With `OutgoingShipmentInvoiceLine.OrderItem` configured
`DeleteBehavior.Cascade`, saving a delivered order does not merely restate
history — it destroys the invoice lines derived from it. Surface 3 is therefore
data loss, not just retroactive restatement.

**Deleting a brewery wipes everything it ever sold.** `Product.Brewery` is
`DeleteBehavior.Cascade` and `DeleteBreweryEndpoint.cs:53` hard-deletes. The chain
runs `breweries → products → order_items → outgoing_shipment_invoice_lines`. This
is surface 5 one hop up and is not in #25 at all.

## Part A — retire products instead of destroying history

### A1. `Product` becomes softly deletable

`Product : PublicEntity` becomes `Product : PublicSoftlyDeletableEntity`, adding
the `is_deleted` column.

`DeleteProductEndpoint` needs **no change**. `AleTrackDbContext.SaveChanges`
already runs `SoftlyDeleteBySettingFlag` (`AleTrackDbContext.cs:187-202`), which
rewrites any `EntityState.Deleted` entry on an `ISoftlyDeletable` entity into a
flag update. The existing `dbContext.Products.Remove(product)` call therefore
becomes a soft delete the moment the base class changes — the same mechanism
`Client` already relies on. The response stays 202.

A consequence worth stating: because the delete never reaches the database, the
`ON DELETE CASCADE` chain never fires for the API path, so A1 alone closes the
reported data loss. A2 is defence in depth for the paths that bypass the
endpoint — raw SQL, the seeder, and the brewery cascade.

**No global query filter.** A new `ProductConfiguration` records the decision,
mirroring the reasoning already written in `ClientDeliveryPlaceConfiguration`: a
`HasQueryFilter` would silently null `oi.Product` inside `DeliveredLineQuery` and
`ShipmentInvoiceMapper`, zeroing report weights and blanking invoice line names
for any retired product, with no error. `Client` can afford a global filter;
`Product` cannot, because it is reached through historical rows.

Filtering is explicit at the selection surfaces instead:

| Filter `!IsDeleted` | Deliberately not filtered |
|---|---|
| `Products/Queries/List` (Ceník) | `SetLoadingState:128` — resolves a product already on the shipment |
| `Products/Queries/Detail` | `SetPurchaseInvoiceLine:135` — same |
| `Products/Queries/ClientHistory` (order suggestions) | every historical read through `order_items.product_id` |
| `Breweries/Queries/ProductList` | |
| `Orders/Commands/Create:119`, `Update:200` | |
| `ProductDeliveries/Commands/Create:130,204`, `Update:199` | |
| `InventoryItems/Commands/Create:88`, `Update:72` | |
| `OutgoingShipments/Commands/Update:528` (stock purchases) | |
| `Products/Commands/Update:57`, `Delete:51` — 404 on an already-retired product | |

The distinction is the rule: a product is filtered where a user *picks* one, and
never where the system *resolves* one that history already references.

### A2. Break the cascade chain

`OrderItem.Product` gains `[DeleteBehavior(DeleteBehavior.Restrict)]`, moving
`order_items.product_id` from Cascade to Restrict. This is the load-bearing
change. It severs both the two-hop path from `products` and the three-hop path
from `breweries`, so no future hard delete — a manual SQL statement, the seeder,
a brewery delete — can reach historical rows again. It also matches
`delivery_items.product_id`, which is already Restrict; that asymmetry is what
indicated the cascade was never a deliberate decision.

`invoice_lines.order_item_id` stays Cascade. It is correct for an item genuinely
removed from an order on a still-editable shipment, and B3 closes the destructive
case by refusing to rebuild items on a frozen order.

### A3. Brewery safety net

Once `order_items.product_id` is Restrict, deleting an in-use brewery fails on a
raw `DbUpdateException` — a 500 rather than data loss, which is a strict
improvement but a poor answer. `DeleteBreweryEndpoint` gains an in-use guard that
refuses a brewery still holding products, reporting the count.

Refusing on *any* product, rather than only products with history, is deliberate:
it is predictable, and it avoids a partial cascade that deletes a brewery's
unused products while failing on the used ones.

Soft-deleting breweries symmetrically was considered and deferred — it needs its
own migration, filtering across the brewery list/detail/picker endpoints, and
frontend work. The Restrict change already closes the data-loss hole.

## Part B — freeze closed records

### B1. One shared predicate

New `Features/OutgoingShipments/Utils/ShipmentMutability.cs` holds both rules:
content editability (`State == Created`) and the transition matrix.

The existing `IsEditable` in `PurchaseInvoiceSplit` and `ShipmentInvoiceGraph`
(`not Delivered or Cancelled`) is left untouched. It governs loading progress and
invoicing, which is a genuinely different question from content: invoice
assignment stays adjustable until delivery, while what is *on* the truck freezes
when the truck is packed.

Transitions are single-step, matching the UI's own one-step `forwardStep` and
`revertTo` maps:

| from ↓ / to → | Created | Loaded | InTransit | Delivered | Cancelled |
|---|:-:|:-:|:-:|:-:|:-:|
| **Created** | = | yes | no | no | yes |
| **Loaded** | yes | = | yes | no | yes |
| **InTransit** | no | yes | = | yes | yes |
| **Delivered** | no | no | no | = | no |
| **Cancelled** | yes | no | no | no | = |

`=` is a no-op and always allowed: every content save re-sends the current state.
`Delivered` is terminal. `Cancelled → Created` preserves the shipped restore
button.

### B2. Content guard on the shipment update

`UpdateOutgoingShipmentEndpoint` evaluates the guard against the **stored** state,
before the new state is assigned. A frozen field is rejected only when the
incoming value actually **differs** from what is stored, which is what lets
`ShipmentDetail.advance()` keep re-sending the whole object with only `state`
swapped.

From `Loaded` onward:

| Field | Frozen |
|---|---|
| stop composition — order set, route position, `SelectedAddressKind`, `ClientDeliveryPlaceId` | yes |
| `CustomStops` — set, labels, coordinates, order | yes |
| `RouteViaPoints` | yes |
| `VehicleId` | yes |
| `StockPurchases` — product set and quantities | yes |
| `Name`, `DeliveryDate`, `DriverIds` | no |
| `State` | no — per the matrix |
| `OrderItems[].IsLoadingConfirmed`, `QuantityFromInventory`, `InventoryItemId` | no — loading progress, while state is not `Delivered`/`Cancelled` |
| `CustomExtraItems[].IsLoadingConfirmed`, `StockPurchases[].IsLoadingConfirmed` | no — same |

`ClientExtraShipments` and `CustomExtraShipments` sit on the DTO but are never
read by the endpoint — extras became the order's own rows. They need no guard;
noting it here so their absence is not read as an oversight.

Rejection is a 400 via a new `ThrowHelper.ShipmentContentFrozen(state,
changedFields)` naming the fields that differed. 400 rather than 409 follows the
existing precedent in `SetLoadingState`, which already answers "shipment no
longer editable" that way. Naming the fields makes the failure diagnosable and
gives the frontend something to show.

### B3. Content guard on the order update

An order's content is frozen when the order is `Finished` or `Cancelled`, **or**
when it sits on a stop of a shipment in `Loaded`, `InTransit` or `Delivered`.

`Cancelled` shipments are deliberately excluded. Cancelling frees its orders back
to `New` for reuse, but the stop link survives the cancellation, so including
`Cancelled` would freeze every freed order permanently.

| Field | Frozen |
|---|---|
| `OrderItems` — product set, quantities, reminder state | yes |
| `ClientId` | yes |
| delivery address (`DeliveryAddressKind`, `ClientDeliveryPlaceId`) | yes |
| `ActualDeliveryDate` | yes |
| `State` | yes |
| notes, returns, `RequiredDeliveryDate` | no |

The mechanism matters more than the rejection: when frozen, the
`OrderItems.Clear()` and re-add is **skipped entirely** rather than performed and
then compared. That is what keeps the rows — and their IDs — alive, and with them
the invoice lines that reference them.

Two fields go beyond what #25 asks for, flagged deliberately:

- `ClientId` — it drives report client and region attribution and the stop's
  delivery address; changing it on a delivered order is unambiguously wrong.
- `State` — the endpoint currently assigns `order.State = req.Data.State`
  unconditionally, letting any caller set any order state and bypass the
  shipment-driven lifecycle. Freezing it on frozen orders prevents un-finishing a
  delivered one.

Returns stay editable because Vrátky are recorded at delivery, and notes because
they are written afterwards.

### B4. Frontend

One line: drop the `Delivered: S.InTransit` entry from the revert map at
`ShipmentDetail.tsx:751`, plus its test.

No request or response DTO changes anywhere in A or B, so **no
`yarn generate-api` run is required.** The guards are behavioural. `structureLocked`
in `ShipmentEditor` already matches the freeze set being implemented, so the
editor needs no change.

## Migration

One migration carrying both schema changes:

- add `products.is_deleted`, `boolean not null default false`
- alter the `order_items.product_id` foreign key from `ON DELETE CASCADE` to
  `ON DELETE RESTRICT`

No backfill: `is_deleted` defaults false, which is correct for every existing
row. The seeder never deletes products, so Restrict introduces no seeding
failure.

## Testing

Tests are pure unit tests against the mocked DbContext, extending the existing
files rather than adding new suites where one already covers the endpoint.

- `UpdateOutgoingShipmentTests` — one rejection case per frozen field; the full
  transition matrix including the no-op and both rejected directions out of
  `Delivered`; loading progress still writable in `Loaded`; an unchanged
  full-object PUT with only `state` advanced still succeeds.
- `DeleteProductTests` — the flag is set and `Remove` is never called; a retired
  product 404s on re-delete; order items and invoice lines survive.
- `UpdateOrderTests` — frozen rejection per field; that items are **not**
  recreated when frozen; that an order freed from a cancelled shipment is still
  editable.
- Brewery delete — refuses with a count when products exist, succeeds when none
  do.
- Product query surfaces — retired products absent from the Ceník and pickers,
  still resolved by `SetLoadingState`.
- Frontend `ShipmentDetail.test.tsx` — no revert affordance on a delivered
  shipment.

## Risks

The transition matrix is stricter than today's "anything goes". Any existing test
fixture that jumps states — `Created → Delivered` directly, for instance — will
start failing. Fixtures get fixed; the matrix does not get loosened to
accommodate them.

Restrict on `order_items.product_id` turns a previously-silent cascade into a
loud failure. That is the point, but it means any code path that hard-deletes a
product now errors. A1 removes the only such path in the API.

## Relationship to part C

Part C snapshots content onto rows the shipment owns, written at the `→ Loaded`
transition. B2 freezes content at exactly that boundary, so the snapshot and the
shipment cannot diverge. `HistoryBuilder`
(`2026-07-28-historical-seed-data-design.md`) will need revisiting when C lands;
A and B leave it untouched.
