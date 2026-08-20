# Shipment content snapshots (issue #25, part C)

**Date:** 2026-07-28
**Status:** design approved, ready to plan
**Issue:** [#25](https://github.com/JanProkorat/ale-track/issues/25)
**Predecessors:**
`2026-07-28-shipment-content-snapshots-design.md` (the original problem write-up),
`2026-07-28-history-integrity-guards-design.md` (parts A and B, shipped)

## Scope

Parts A and B are done: products are retired rather than cascade-deleted, and the
content of a shipment or order freezes when the run leaves `Created`. What remains
is surfaces 1 and 2 of #25 — the records that still read the *current* product,
client and brewery row at display time.

Part B is a precondition and now holds, so a snapshot taken at the `→ Loaded`
transition cannot drift from the shipment it describes.

## The two rules that decide every column

### Snapshot facts, read presentation live

Product identity, name, package size, units per package, unit prices, quantities,
client name and region, brewery identity and name are facts about what happened.
They freeze.

Brewery **colour** does not. It is presentation: recolouring a brewery should
repaint old charts too, so it stays a live join against `breweries`. Freezing it
would strand historical charts on a colour the user has since changed.

### Snapshot the weight formula's inputs, not its output

`ProductWeightCalculator` stays live and `WeightKg` stays a derived property.
`kind`, `package_size` and `units_per_package` are snapshotted.

The distinction is load-bearing. Two kinds of change have looked identical until
now:

- A **formula** correction — `FiveKilos` returning 2 instead of 5, the missing
  bottle-crate weights — fixes a computation that was always wrong. It *should*
  propagate to history.
- A **data** correction — Svijany bottles moving from a 10 l package size to
  0.5 l — changes what a product is said to be. It must *not* rewrite what was
  delivered last month.

Snapshotting the inputs and deriving the output separates them. Storing a
computed `weight_kg` would freeze both, leaving known-wrong weights permanently
wrong.

## Schema

### New: `outgoing_shipment_stop_items`

The run owns what it carried.

| Column | Notes |
|---|---|
| `id`, `public_id` | standard `PublicEntity` |
| `stop_id` | → `outgoing_shipment_stops`, `ON DELETE CASCADE` |
| `order_item_id` | → `order_items`, **`ON DELETE SET NULL`** — provenance only |
| `product_id` | → `products`, **`ON DELETE SET NULL`** — provenance only |
| `product_name`, `kind`, `type` | snapshot |
| `package_size`, `units_per_package` | snapshot; weight inputs |
| `quantity` | snapshot |
| `unit_price_with_vat`, `unit_price_without_vat` | snapshot |
| `brewery_public_id`, `brewery_name` | snapshot; report grouping identity |

Real columns rather than `JSONB`: the reports aggregate over these and want
indexes and joins. Indexed on `stop_id`.

`type` is included because `DeliveredLineRow` carries `ProductType` and the volume
reports group by it. `brewery_public_id` rather than a `brewery_id` FK because the
reports group by public id, and the value must survive the brewery row going away.

### `outgoing_shipment_stops`

Gains `client_public_id`, `client_name`, `client_region` — populated for order
stops only. The stop already snapshots the delivery address (`Latitude`,
`Longitude`, `Label`, `SelectedAddressKind`, `IsAddressOverridden`,
`AddressChangedAt`); client attribution completes that pattern.

**Drops `client_order_id`.** See "Deviations" below.

### `outgoing_shipment_invoice_lines`

Gains `product_name`, `unit_price_with_vat`, `unit_price_without_vat`.

The line does not simply point at a stop item, because it is its own historical
record: it bills a *fraction* of an item to a *particular* client, which is why it
already snapshots `Quantity`. For a line sourced from an `OrderCustomExtraItem`,
`product_name` holds the extra's description and both prices are null — matching
what the mapper returns for extras today.

### `delivery_items`

Gains `kind`, `package_size`, `units_per_package`. This is the incoming (Dovozy)
half of the Operations chart, a different aggregate from shipments, so it takes
columns on its own rows rather than joining the stop-items table.

## Write points

One boundary, the same one part B established: **`Created` means everything is
live and refreshing; `Loaded` onward means everything is frozen.**

- A new `ShipmentContentSnapshotWriter` builds the stop items and the stop's
  client snapshot on the `→ Loaded` transition.
- On a revert `Loaded → Created` it **deletes** them. Content becomes editable
  again at that point, and a stale snapshot is worse than no snapshot. They are
  rebuilt on the next `→ Loaded`.
- Invoice line snapshots are written when a line is created, and refreshed during
  reconciliation only while the shipment is `Created`.
- Delivery item snapshots are written whenever the delivery line is written.

### The invoice line's snapshot source is deterministic

No coalesce, no ambiguity:

- shipment in `Created` → the live product (correct: it *is* the current truth,
  and no stop items exist yet)
- shipment `Loaded` or later → the stop item for that order item

This is why C1 lands before C2: C2's post-`Loaded` source does not exist until C1
has built it.

## Read points

- `DeliveredLineQuery` re-bases from `dbContext.OrderItems` onto
  `dbContext.OutgoingShipmentStopItems`, joining stop → shipment for state and
  delivery date, the stop for client attribution, and `breweries` by public id for
  the live colour.
- `ShipmentInvoiceMapper.FromOrderItem` reads the line's own snapshot rather than
  `item.Product`. It still resolves the order to derive the *ordering* client,
  which is what the UI compares against the invoice's client to show
  "cross-billed".
- `GetOperationsEndpoint`'s incoming projection reads the `delivery_items`
  columns.

Once these land, `Product` is no longer read by any historical display path, which
is what makes part A's decision to omit a global query filter safe in the long
run rather than merely correct today.

## Backfill

One migration carrying schema and data together, backfilling from the values live
at migration time:

- stop items for every stop on a shipment in `Loaded`, `InTransit`, `Delivered`
  or `Cancelled`, from its order items joined to products and breweries
- invoice line `product_name` and prices, from order items joined to products, and
  from custom extra descriptions
- `delivery_items` weight inputs from products
- stop `client_public_id` / `client_name` / `client_region` from the linked order's
  client

Read paths then **require** the snapshot. No fallback to the live row anywhere:
a coalesce on every historical read is permanent complexity, and it makes a
snapshot-writer bug indistinguishable from legitimately old data.

**Documented limitation, stated in the migration and here rather than hidden:**
pre-migration history reflects product and client values as of the migration date,
not as of the delivery. That is the most the existing data can support.

`gen_random_uuid()` supplies `public_id` for the backfilled stop items; it is
built in on Postgres 17, which is what `docker-compose` runs and what Supabase
provides.

## Deviations from the issue, deliberate

### The 1:N `Order` ⇄ `OutgoingShipmentStop` widening is dropped

The issue opens with it as the motivating change. It is no longer needed. Once the
stop owns its items, a cancelled shipment renders from its own rows; re-planning
the freed order moves only the provenance link and the display does not depend on
it. The issue anticipated this — "the cardinality question largely dissolves" — and
it dissolves completely.

### `client_order_id` is deleted, not promoted to a real foreign key

The issue proposes giving it one. Nothing in the codebase reads
`OutgoingShipmentStop.ClientOrderId`; `HistoryBuilder.cs:231-234` documents it as
"a mapped scalar EF does not use as the key", and existing rows hold `0` or
`NULL`. The relationship is keyed on `orders.outgoing_shipment_stop_id` with
`Order` as the dependent. A second key beside it would be a second trap, and with
the widening dropped there is nothing for it to do.

### Shipment-scoped fields stay on `order_items`

`IsShipmentLoadingConfirmed`, `QuantityFromInventory` and `InventoryItemId`
describe the loading an order currently sits on, so they arguably belong on stop
items. Nothing in this work needs them moved, and moving them would drag the
nakládka, the purchase split and the inventory drawdown along. Left alone
deliberately; a candidate for a later change.

### The product-edit warning is static

The UI gets a fixed informational line in the product form — *"Změna se nepromítne
do vystavených faktur ani do historie reportů."* — rather than a conditional
in-use check. It carries the same information without a DTO change, so **no part
of C requires `yarn generate-api`**, and `src/generated/api-client.ts` must not
change.

## Decomposition

Roughly 25 files and a large backfill, so this is two plans, run in order.

**C1 — reports own their history**
Stop items entity, configuration and migration with backfill;
`ShipmentContentSnapshotWriter` and its wiring into the `→ Loaded` and
`→ Created` transitions; client and brewery attribution on the stop;
`DeliveredLineQuery` re-based and the three report endpoints following;
`HistoryBuilder` populating snapshots.

Headline test: **editing a product after delivery does not change report output.**

**C2 — billing owns its history**
Invoice line snapshot columns and backfill; `ShipmentInvoiceMapper` and the
reconciler writing and reading them; `delivery_items` weight inputs and the
Operations incoming projection; the product-form note.

Headline test: **repricing a product does not restate an issued invoice.**

## Testing

Unit tests against the mocked DbContext, as everywhere else in this codebase.

- Snapshot writer: builds items on `→ Loaded` with values copied from the live
  product; deletes them on a revert to `Created`; rebuilds on re-load; snapshots a
  since-retired product without complaint.
- `DeliveredLineQuery`: reads snapshot columns, not the product; a product edited
  after delivery leaves report output unchanged; weight still derives, so a
  formula change *does* move it.
- Report endpoints: brewery colour follows the live brewery while name and
  identity follow the snapshot.
- Invoice mapper: reads the line snapshot; a repriced product leaves an issued
  invoice unchanged; a custom-extra line shows the description and null prices.
- Reconciler: refreshes snapshots while `Created`, leaves them alone from `Loaded`,
  and sources a newly created post-`Loaded` line from the stop item.
- Operations: incoming weights read `delivery_items` columns.

The backfill SQL cannot be exercised by the mocked-DbContext suite. It is verified
by hand against the local Postgres before the work is called done — schema
migration applied, row counts compared against the source query, and one delivered
shipment's report output diffed before and after a deliberate product edit.

## Risks

Re-basing `DeliveredLineQuery` changes the meaning of existing report output. With
the backfill in place the numbers move only where a product has been edited since
the row was written — which is precisely the bug being fixed, so the movement is
the point. Worth mentioning to whoever reads the next Reporty screenshot.

`DeliveredLineQuery` has a documented trap: callers must materialize before
touching `Date` or `WeightKg`, because both are computed in memory and
`Moq.EntityFrameworkCore` mocks LINQ-to-objects, so composing further onto the
deferred `IQueryable` passes tests and fails only against real Npgsql. The
re-based query keeps that shape and the remark stays.
