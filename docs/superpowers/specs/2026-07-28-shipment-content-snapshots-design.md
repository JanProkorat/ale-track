# Historical records read live data (shipment content snapshots)

**Date:** 2026-07-28
**Status:** problem described, fix not yet planned

## Summary

Closed-out records — delivered shipments, cancelled shipments, issued invoices,
report history — do not store what they contained. They hold foreign keys and read
the current row at display time. Editing a product, a price or a delivered order
therefore rewrites history retroactively, silently, with no audit trail.

This blocks a feature (viewing a cancelled shipment's planned content), is already
producing wrong output in billing, and has one path that destroys data outright.

## How this surfaced

The immediate question was whether `Order` ⇄ `OutgoingShipmentStop` should become
1:N so a cancelled shipment can show the orders that were planned onto it.

1:N is necessary but not sufficient. With the relationship widened and the display
joining through to `order_items`, a cancelled shipment would render the order *as it
is now*, not as it was when planned. The missing piece is not cardinality, it is
that the shipment owns no content of its own.

## Evidence

### 1. Invoice prices are read live — wrong output today

`OutgoingShipments/Queries/Invoices/ShipmentInvoiceMapper.cs:94-97`

```csharp
Name        = item.Product?.Name ?? string.Empty,
PriceWithVat = item.Product?.PriceWithVat,
```

`OutgoingShipmentInvoiceLine` snapshots `Quantity` but keeps `OrderItemId` and
reaches through to the product for name and price. Repricing a product restates
every invoice that ever contained it. In a billing context this is a correctness
bug, not a cosmetic one.

This is not hypothetical. On 2026-07-28 the Svijany seed data was corrected:
`Svijanský Vozka` bottle unit price moved 12.09 → 11.49 and nine bottled products
moved from a 10 l package size to 0.5 l. Every historical invoice and every report
weight touching those rows changed with it. Nothing flagged it.

### 2. Report history is not stable

`Features/Reports/Utils/DeliveredLineRow.cs` projects `oi.Quantity`,
`oi.Product.Kind` and `oi.Product.PackageSize` live, and weight is then derived from
`Kind` + `PackageSize`. `GetOperationsEndpoint` does the same on the incoming side
via `di.Product`. Client attribution reads `oi.Order.Client.Name` and
`Client.Region`, so renaming a client or moving it between regions rewrites past
reports too.

A report run twice over the same closed window can legitimately return different
numbers.

### 3. Delivered orders are editable

`Orders/Commands/Update/UpdateOrderEndpoint.cs` has no state guard — nothing stops
an order in `Finished` from having its items or quantities changed. Combined with
(2), editing a delivered order silently restates report history.

### 4. Deleting a product destroys history — data loss

```
products --ON DELETE CASCADE--> order_items
order_items --ON DELETE CASCADE--> outgoing_shipment_invoice_lines
```

`Products/Commands/Delete/DeleteProductEndpoint.cs:55` calls
`dbContext.Products.Remove(product)` with no in-use check. Deleting a single product
from the Ceník cascades two hops and removes every historical order line for it plus
every invoice line derived from those lines.

The same relationship on the incoming side, `delivery_items.product_id`, is
`ON DELETE RESTRICT`. The inconsistency indicates the cascade was not a deliberate
decision.

**This is the most urgent item here and is independent of the snapshot work.**

## Why this is not a database-choice problem

The question was raised whether MongoDB would suit this better, given that
client-specific price overrides will need similar treatment.

It would not, and it would not help. In a document store the same decision appears
unchanged: embed the order inside the shipment document (a snapshot) or store an
`orderId` (a live reference with identical staleness). Embed-versus-reference *is*
snapshot-versus-foreign-key. The engine does not decide it; the schema author does,
in the same place, for the same reason.

Against that, moving would give up referential integrity the schema actively relies
on (`RESTRICT` / `SET NULL` / `CASCADE` across roughly a dozen relationships), the
multi-join aggregation the entire Reporty module is built on, EF Core migrations,
and the existing test suite. Postgres also already provides `JSONB` for the cases
where a document shape genuinely fits.

The work is a schema change, not a database change.

## Proposed direction

### Shipments own their content

When a shipment leaves the editable states (→ `Loaded`), copy its content into rows
the shipment owns:

```
outgoing_shipment_stop_items
  stop_id
  product_id                                  -- provenance only, ON DELETE SET NULL
  product_name, kind, package_size            -- snapshot
  quantity                                    -- snapshot
  unit_price_without_vat, unit_price_with_vat  -- snapshot
```

Real columns rather than `JSONB`: the reports aggregate over these fields and want
indexes and joins. Reserve `JSONB` for display-only payloads.

With the stop carrying its own content, the cardinality question largely dissolves.
`outgoing_shipment_stops.client_order_id` becomes a nullable provenance link, and
many stops may reference one order over time without anything authoritative hanging
off the relationship.

Note that `client_order_id` exists today as a mapped scalar which is *not* the
foreign key and which EF never populates — the relationship is keyed on
`orders.outgoing_shipment_stop_id` with `Order` as the dependent
(`AleTrackDbContextModelSnapshot.cs:2009`). Existing rows hold `0` or `NULL`. Giving
it a real foreign key is part of this work.

### There is precedent in the codebase

The stop already snapshots the delivery address: `Latitude`, `Longitude`, `Label`,
`SelectedAddressKind`, `IsAddressOverridden`, `AddressChangedAt`, plus an
`AcknowledgeAddressChanges` command that surfaces drift between the recorded address
and the client's current one. That is snapshot-plus-drift-detection, built once,
for addresses, presumably because addresses caused this pain first. Prices,
quantities and product identity have the same exposure and none of the machinery.

### Client price overrides are two things

Worth separating before building, because conflating them is what made a document
store look attractive:

- **The rule** — "client X pays Y for product Z". Live, editable, queryable,
  wants foreign keys. An ordinary `client_product_prices` table. Not a snapshot.
- **The applied price** — what was actually charged on a line. A snapshot, resolved
  once and frozen onto the line.

Normalized rules, frozen results on the transaction row — the same shape as the rest
of this document.

### Open question

Should `DeliveredLineQuery` read snapshots instead of live products? Doing so is what
makes report history stable, but it changes the meaning of existing report output and
needs a backfill decision for rows predating the snapshot columns. Decide as part of
planning this work, not now.

## Relationship to the historical seed data

`docs/superpowers/specs/2026-07-28-historical-seed-data-design.md` generates history
against the current schema. If stops gain snapshotted items, `HistoryBuilder` should
populate those rather than lean on live order items. The seed is deliberately being
built first to unblock the Reporty module; it will need revisiting when this lands.
