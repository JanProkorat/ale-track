# Brewery purchase invoices in the nakládka table

**Date:** 2026-07-25
**Scope:** Full-stack. A second, independent invoice split on an outgoing
shipment — this time for the invoices the **brewery issues to us** — edited
directly in the "Celková nakládka" table. Plus the rename and repair of the
mislabelled "Dokládka ze skladu" feature.

## Goal

`Fakturace` (see `2026-07-25-shipment-invoicing-design.md`) answers *which
pieces go on which invoice we issue to a client*. It says nothing about the
other direction: the brewery hands us its own invoice(s) for the same run, and
occasionally splits one run across two of them. Today that cannot be recorded
anywhere.

The operator needs to say, per product in the nakládka: *of these 24 pieces, 20
are on the brewery's first invoice and 4 on its second.*

## Two features that looked like one

The request began as "remove the redundant *Dokládka ze skladu* button — the
blue `− N ze skladu +` stepper does the same thing". It does not. They point in
opposite directions:

| Control | Writes | Meaning |
|---|---|---|
| blue `− N ze skladu +` | `OrderItem.QuantityFromInventory` | of the pieces this client ordered, N come off **our shelf** instead of the brewery's pallet |
| `Dokládka ze skladu` | `OutgoingShipmentInventoryExtraItem` | N extra pieces **bought from the brewery** that ride along and are unloaded **into our warehouse** |

The backend always meant the second one — `UpdateOutgoingShipmentEndpoint`
calls `AddExtraItemsToInventoryAsync` on the transition to `Delivered`, i.e. it
**adds** the goods to stock. The frontend implemented it backwards: the dialog
offers only products already in stock (`stockOptions`, qty > 0) and
`adjustDokladka` caps increases at stock on hand. Both belong to "take from
stock"; the persistence belongs to "buy into stock". The label
"Dokládka **ze skladu**" cemented the wrong reading.

So the feature is kept, renamed **"Zboží na sklad"**, and repaired.

## Data model

```
outgoing_shipment_purchase_invoices
  id, public_id, outgoing_shipment_id, sequence, label?

outgoing_shipment_purchase_invoice_lines
  id, public_id, purchase_invoice_id, product_id, quantity
```

`label` is optional free text (max 30) for the brewery's real invoice number.
`sequence` starts at 1 and orders the columns; it is not an invoice number.

Two deliberate differences from the client-facing `OutgoingShipmentInvoice`:

**Lines carry `product_id`, not a source item.** A purchase invoice does not
care which client ordered the beer, only how many pieces we bought. The
aggregated nakládka row is therefore exactly the right granularity — which also
sidesteps the greedy-distribution bug that the sales split had to solve
(`ShipmentInvoiceReconciler` exists because an aggregate split had to be pushed
down into per-order items; here it does not).

**Only invoices with `sequence >= 2` store lines.** Invoice 1 is the
*remainder*: `purchased total − Σ(lines on other invoices)`, computed on read,
never materialised. One number is stored per exception, and the split cannot
drift out of balance because nothing else is stored to drift.

### Purchased total

Per product, per shipment:

```
Σ over order items (quantity − quantity_from_inventory)
+ Σ over stock-purchase items (quantity)
```

Pieces sourced from our own stock were bought on an earlier run and invoiced
then; billing them again would double-count. A row whose purchased total is 0
(everything came off our shelf) shows `—` and disables its inputs.

### No brewery on the invoice

With the remainder model, invoice 1 holds whatever was not typed into another
column — in a two-brewery run that spans both breweries, so a `brewery_id` on
the invoice would be false. Multi-brewery runs (rare) simply get enough columns;
the product row identifies its own supplier. Revisit only if brewery grouping
inside the table is ever asked for.

### Rename

`OutgoingShipmentInventoryExtraItem` → `OutgoingShipmentStockPurchaseItem`
(`outgoing_shipment_stock_purchase_items`), `InventoryExtraShipmentDto` →
`StockPurchaseDto`, `OutgoingShipment.InventoryExtraItems` → `StockPurchases`,
and the detail DTO field with them. One migration covers the rename and the two
new tables.

## Clamping (the only implicit mutation)

There is no reconciler. On read and on write, every stored line is clamped to
the product's purchased total minus the other invoices' lines for that product,
and lines for products no longer in the shipment are deleted. Because invoice 1
is derived, that is enough to keep the split valid; there is no precedence
question to get wrong.

Deleting an invoice deletes its lines and the pieces fall back into the
remainder — no unwind logic.

## Endpoints

Following `Features/OutgoingShipments/Commands/{AddInvoice,DeleteInvoice,MoveInvoiceLine}`:

| Verb | Route | Effect |
|---|---|---|
| POST | `/outgoing-shipments/{id}/purchase-invoices` | append the next `sequence`; when none exist yet, create 1 **and** 2 so the columns appear |
| DELETE | `/outgoing-shipments/{id}/purchase-invoices/{invoiceId}` | delete it and its lines; `sequence` of later invoices is compacted |
| PUT | `/outgoing-shipments/{id}/purchase-invoices/{invoiceId}/lines` | upsert `{productId, quantity}`; 0 deletes the line; rejected for `sequence == 1` |
| PATCH | `/outgoing-shipments/{id}/purchase-invoices/{invoiceId}` | set `label` |

`GetOutgoingShipmentDetailEndpoint` projects `purchaseInvoices: [{ id, sequence,
label, lines: [{ productId, quantity }] }]`. Permissions: `ModuleType.Shipments`,
`View` to read / `Edit` to change, read-only in `Delivered` and `Cancelled`,
matching the rest of the nakládka.

## Frontend

`+ Faktura pivovaru` sits in the "Celková nakládka" card header next to
`Zboží na sklad`. With fewer than two invoices the table is unchanged. From two
on, one column per invoice appears between `Množství` and `Nadiktováno`:

```
┌─────────┬────────┬───────┬───────┬─────┬─────┐
│ Produkt │Množství│ F1  ░ │ F2    │ Nad.│ Kon.│
│ Leg.11° │  24 ks │  20 ░ │ [  4] │  ☑  │  ☑  │
│ Leg.12° │  12 ks │  12 ░ │ [  0] │  ☑  │  ☐  │
├─────────┼────────┼───────┼───────┼─────┼─────┤
│ Celkem  │  36 ks │  32 ░ │     4 │     │     │
└─────────┴────────┴───────┴───────┴─────┴─────┘
```

Column 1 is computed and grey; columns 2+ are number inputs capped at
`purchased total − Σ other columns`, so the remainder can never go negative.
Each header shows `Faktura N`, an editable label, and (from 2 on) a `×`.

Shaping logic lives in `purchaseSplitModel.ts` next to `ShipmentDetail.tsx`,
per the house rule that a growing feature file sheds its pure logic into a
sibling module: purchased total per aggregated row, remainder, per-column
totals, input cap.

### Zboží na sklad repairs

- picker source: brewery product catalogue instead of `stockOptions`
- no stock-on-hand cap in the quantity stepper
- chip reads `na sklad`, summary reads `N ks na sklad`

## Testing

**Backend** — clamp on write and on read, delete-invoice frees pieces, product
removed from the shipment drops its lines, remainder derivation with two and
three invoices, `sequence == 1` line write rejected. Existing tests touching the
renamed inventory extras are updated.

**Frontend** — `purchaseSplitModel.test.ts` covers purchased total (including a
row fully sourced from stock), remainder, and the cap. Component tests cover
columns hidden with one invoice, the cap refusing an over-large entry, and the
read-only state for a delivered shipment.

## Non-goals

- No supplier-invoice documents, dates, amounts or payment state — `label` is
  the only identifying field, and it is free text.
- No brewery grouping in the table.
- No link between a purchase invoice and the client invoices for the same goods.
