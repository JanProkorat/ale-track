# Shipment invoicing (Fakturace)

**Date:** 2026-07-25
**Scope:** Full-stack. New first-class invoice structure on outgoing shipments +
a new `Fakturace` section on the shipment detail page. Removes the existing
F1/F2 invoice-quantity columns entirely.
**Prototype:** `docs/prototype/aletrack-prototype.html#/shipments/s-1` (approved).

## Goal

Invoices are created per outgoing shipment — normally one per client, covering
everything that client receives on that run. The operator needs to see, per
shipment, which products land on which invoice, and be able to move pieces
between invoices — including onto **another client's** invoice. That last case is
rare (once in many months) but real, and today it cannot be expressed at all.

No documents are generated in this phase. The deliverable is the backend
structure plus the on-screen split.

## Why the current model cannot do it

`OrderItem`, `OutgoingShipmentInventoryExtraItem`, `OutgoingShipmentClientExtraItem`
and `OutgoingShipmentCustomExtraItem` each carry `first_invoice_quantity` /
`second_invoice_quantity`. Three problems:

1. **Exactly two invoices, hardcoded in the schema.** A shipment with six clients
   needs at least six invoices.
2. **No invoice identity.** There is nowhere to record whose invoice "invoice 2"
   is, so cross-client billing is inexpressible.
3. **The UI split was arbitrary.** `ShipmentDetail.tsx` aggregates rows per
   product across every client (`aggregateRows`), puts the F1/F2 stepper on the
   aggregate, and `applyInvoiceDistribution` pushes the count down into the
   underlying order items **greedily**. Which client's order absorbed the split
   was effectively random.

Also worth recording: `GetOutgoingShipmentDetailEndpoint` never projected the
invoice quantities for **order items** at all (only for extras), so the frontend
read `undefined` for them. The feature was never fully wired end to end.

## Separation of concerns (the core decision)

Two audiences, two sections, no shared fields:

| Section | Audience | Answers |
|---|---|---|
| **Nakládka** | drivers + brewery customer support | what to load into the van, has it been loaded and checked |
| **Fakturace** | app users doing the billing | which pieces go on which client's invoice |

The invoice columns are therefore **removed** from the nakládka DTOs and update
path rather than carried forward. Nakládka keeps quantity, dokládka, `Naloženo`
and `Kontrola` only.

## Data model

Materialised invoices and lines — chosen over "derive the default, persist only
deviations" because invoice identity is needed regardless (arbitrary count per
client, plus "move to client B's *second* invoice"), and because document
generation later becomes additive instead of a migration.

```
outgoing_shipment_invoices
  id, public_id, outgoing_shipment_id, client_id, seq

outgoing_shipment_invoice_lines
  id, public_id, invoice_id, quantity,
  source_kind (OrderItem | ClientExtra | CustomExtra),
  order_item_id?, client_extra_item_id?, custom_extra_item_id?
```

`source_kind` + nullable FKs follows the existing house pattern on
`outgoing_shipment_stops` (`kind` + nullable `client_order_id`).

The **ordering client** of a line is derived from its source, never stored twice:
for an order-item line it is the order's client; for an extra it is the extra's
new `client_id`. A line is **cross-client** when that client differs from its
invoice's `client_id`.

### Schema changes to existing tables

- **Drop** `first_invoice_quantity` / `second_invoice_quantity` from `order_items`,
  `outgoing_shipment_extra_items`, and the client/custom extra tables.
- **Add** `client_id` to `OutgoingShipmentClientExtraItem` and
  `OutgoingShipmentCustomExtraItem`. Both are delivered to a specific client and
  are therefore billable, but neither records who receives them today.
- `OutgoingShipmentInventoryExtraItem` is **never invoiced** — those goods come
  back to our own inventory. Its invoice columns are dropped with no replacement.

## Reconciliation

One service, `ShipmentInvoiceReconciler`, is the only place that mutates the
split implicitly. It guarantees:

1. Every client with billable items in the shipment has at least one invoice.
2. Every line points at a source item still present in the shipment.
3. For every billable item, `Σ line.quantity == item.quantity` (+ dokládka).

Surplus lands on the ordering client's **first** invoice. A shortfall is trimmed
in this order:

1. other clients' invoices (highest `seq` first),
2. the ordering client's extra invoices (highest `seq` first),
3. the ordering client's **first** invoice, last.

**Rationale:** a cross-client line is an exception the user created deliberately,
but wiping the owner's own claim first is worse — it makes a product vanish from
its orderer's invoice and survive only on someone else's. The owner keeps what
still exists; the exception is what no longer fits. This was caught by test: the
first implementation sorted by `seq` alone and, with two `seq`-1 invoices, ate the
home invoice first.

Deleting an invoice needs no unwind logic — drop the row and let reconciliation
return the pieces to each item's home invoice.

### Reporting drift to the user

Reconciliation is automatic (data is never left inconsistent) but **not silent**.
Every change it makes to an **already-split** item is recorded and surfaced in the
Fakturace header as a dismissible banner: *"Množství v nakládce se změnilo —
rozdělení na faktury bylo upraveno"* plus per-product detail (`+3 ks přidáno na
1. fakturu objednavatele`, `odebráno 5 ks (nejdřív z přefakturovaných)`,
`odebrána z nakládky, řádky faktur zrušeny`).

**Materialising a default split for the first time is not drift and is never
reported** — otherwise the banner would fire on first open of every shipment,
listing every item.

## Frontend design

New full-width `Fakturace` card on the shipment detail page, below the existing
map / nakládka / vehicle grid.

### Client bands

A vertical stack, one band per client in route order. Band header: stop number
badge (`colorForClient`), client name, `N faktur · N ks · value` rollup, a
`N× přefakturováno` pill when that client's invoices hold cross-billed lines, a
per-client `+ Faktura` button, and a collapse toggle. Header-level
`Sbalit vše` / `Rozbalit vše` when there is more than one client.

Bands stack vertically rather than wrapping in a grid, because a card grid
(`auto-fill, minmax(300px,1fr)`) split one client's invoices across a row
boundary and left ragged holes under short cards.

### Lines are full-width table rows

One `.tbl` per band, not fixed-width cards: a client normally has exactly **one**
invoice, and a 340px card in a ~1800px band wastes most of the row. Columns:
`Produkt` (name + kind chip + provenance chips inline) / `Množství` / `Hodnota` /
move button.

The per-invoice sub-header row (`Faktura N · ks · value` + delete) appears **only
when a client has two or more invoices** — with one invoice it would just repeat
the band header.

### One row per product, chips carry provenance

The same product can reach one invoice from several sources. Display merges them
into a single row; the underlying lines stay separate so provenance is never
lost. Chips:

- `ze skladu` / `N ks ze skladu` — sourced from our warehouse, not the brewery
- `obsahuje dokládku` — order item with dokládka added on top
- `N ks z obj. <klient>` — cross-billed portion, with the piece count when the
  row mixes sources

### Moving pieces

The move dialog takes a **partial quantity** — one order item can appear on
several invoices. Target is a `<select>` with an `<optgroup>` per client listing
every invoice in the shipment plus *"+ nová faktura"* for that client.

When the row merges several sources, the dialog adds a **`Původ kusů`** selector
(each source with its piece count, largest preselected) and the quantity cap is
enforced against the **chosen source**, not the row total. Without it there would
be no way to say whether you are moving the client's own pieces or the
cross-billed ones.

## Permissions

`ModuleType.Shipments` — `View` to read the split, `Edit` to change it. No new
module. The section is read-only for shipments in `Delivered` or `Cancelled`
state, matching the nakládka rule.

## The frontend ↔ backend contract

Backend DTO changes and their frontend consumption ship in the same commit;
`app/src/generated/api-client.ts` is regenerated via `yarn generate-api` against
the running backend. Removing the invoice fields from the nakládka DTOs is a
breaking client change and must not be split across commits.

## Testing

- **Reconciler unit tests** are the core deliverable, not an afterthought — this
  is where drift bugs would live. Cover: first materialisation, quantity raised,
  quantity cut below an existing split (asserting the trim precedence above),
  source item removed from the shipment, invoice deleted while holding pieces,
  client removed from the shipment, and the invariant `Σ lines == Σ loaded` after
  each.
- **Endpoint tests** follow the existing `AleTrack.Tests/Features/OutgoingShipments`
  pattern (xUnit + FluentAssertions + Moq.EntityFrameworkCore, no database).
- **Existing shipment tests** must be updated where they assert the dropped
  invoice fields.
- **Frontend tests** for the Fakturace section: merged row rendering, per-origin
  move cap, band collapse, drift banner shown/dismissed.

The prototype logic was validated by a throwaway node harness (60 assertions)
covering all of the above, including a 9-stop / 6-band / 10-invoice case.

## Non-goals (this phase)

- No invoice documents, numbering, dates, or export. The `seq` field orders
  invoices within a shipment; it is not an invoice number.
- No prices per client — `Hodnota` uses the product's default `PriceWithVat`,
  same as the rest of the app today. Client-specific pricing is its own subsystem
  (see the reporting spec, which defers revenue for the same reason).
- No invoice state machine (issued / paid / cancelled).
- Inventory extra items remain outside invoicing.
