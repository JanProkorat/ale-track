# Fakturace — per-order readiness and the export's own numbering

**Date:** 2026-08-23
**Status:** Implemented
**Branch:** `feature/invoice-row-readiness` (off `dev`)
**Extends:** `2026-08-21-linked-clients-invoicing-design.md`

## Problem

The office finishes a run's invoicing one client at a time: prices checked, cross-billing sorted,
sub-client addresses picked. There is nowhere to record that a client's part is *done*, so the
export file is either taken too early — carrying rows still being edited — or not at all.

The export has a second problem the same change fixes. It is built around stops: a sheet per
delivery, which is the driver's document, printed for an audience that already has the route in the
van. What the office needs from the file is the invoicing, and the invoicing part currently
identifies each client by its **stop number**, which moves whenever the route is reordered. A
number the office writes onto a paper invoice cannot move.

## Decisions

| Question | Decision |
|---|---|
| What is marked | One Fakturace row = one client on one run. Not an invoice, not an order. |
| Sub-client groups | No special case needed — a payer's sub-clients have no row of their own, so the payer's flag already covers the group |
| Where it lives | New `outgoing_shipment_invoice_confirmations`, one row per (shipment, client) |
| Numbering | Assigned on marking ready: first row marked gets 1, second 2, … Per shipment; restarts at 1 on the next run |
| Route order | Still sorts the Fakturace table; no longer supplies the number |
| Un-marking | Allowed, and the number is kept — re-marking returns the same one |
| Locking | **None.** The flag decides the number and the export contents, nothing else |
| Export: first page | Unchanged — run header, full route table, warehouse block |
| Export: stop sheets | Deleted |
| Export: body | One numbered section per ready client, in number order |
| Unready row | Absent from every numbered section; still listed on the route table |
| Nothing ready | File is still produced: overview only, no Fakturace part |

### Rejected alternatives

**A column on `outgoing_shipment_invoices`.** The natural place until you look at what a Fakturace
row is. A client can hold two invoices on one run (one flag and one number, not two); a payer that
only pays for its sub-clients has an invoice but no delivery; a client whose every piece is private
has a delivery but no invoice. Only the (shipment, client) pair covers all three.

**A column on `outgoing_shipment_stops`.** Fails the payer with no delivery — the very row the
group rule is about — and gives two flags to a client with two stops on one run.

**A flag on `orders`.** Would follow the order everywhere, which sounds like a feature until the
order is re-planned onto another run carrying a stale "ready" from the last one. Readiness is a
fact about an order *on this run*.

**Freezing the route number instead of counting confirmations.** Considered and rejected in
brainstorming: it leaves gaps in the file (a file starting at 2) and the numbers then depend on a
route the office did not choose.

## Data model

New entity `OutgoingShipmentInvoiceConfirmation`, table `outgoing_shipment_invoice_confirmations`,
base `PublicEntity` — the office's record that one client's billing on one run is final.

| Column | Notes |
|---|---|
| `outgoing_shipment_id` | Cascade with the run |
| `client_id` | `DeleteBehavior.NoAction`, as everywhere a client is referenced from a run |
| `number` | Confirmation number, from 1 per shipment |
| `is_ready` | False after un-marking; the row and its `number` stay |

Two unique indexes: `(outgoing_shipment_id, client_id)` — one record per client per run — and
`(outgoing_shipment_id, number)`, which is what makes a double assignment a database error rather
than two rows sharing a number.

`number` is assigned as `max(number) + 1` over the run's existing confirmations, the first time a
row is marked ready. It is never reassigned, so un-marking and re-marking is idempotent and gaps
appear only where a row was un-marked and left that way.

Migration `AddInvoiceConfirmations` — additive, no data move. Existing runs come out with no
confirmations at all, i.e. nothing ready, i.e. an export of overview only. That is correct rather
than convenient: on a delivered run the file has already been taken, and on a live one the office
has not confirmed anything yet.

## Backend

### `SetInvoiceReadinessEndpoint`

`PUT outgoing-shipments/{Id:guid}/invoices/clients/{ClientId:guid}/readiness`, body
`{ isReady: bool }`. `Shipments: Edit` + `Capability.Invoicing`, 204 on success — the same shape as
`SetInvoiceBillingRecipientsEndpoint`, which it sits beside.

Guards:

- 404 when the shipment does not exist, or when `ClientId` names no client with a Fakturace row on
  it. "Has a row" means: holds at least one invoice on the run, or holds pieces kept off every
  invoice. Deliberately **not** `ShipmentInvoiceGraph.EligibleClientIds`, which is wider — it
  includes a sub-client whose every piece is billed to its payer, and such a client has no row on
  the table. Letting it be marked would hand a number to a client the file never prints, and break
  the rule that a group is confirmed once, on its head.
- 400 when `ShipmentInvoiceGraph.IsEditable(shipment)` is false. A delivered or cancelled run's
  invoicing is history; its readiness is too.

Setting ready on an already-ready row, or clearing an absent one, is a no-op that still answers 204
— the UI's checkbox is idempotent by nature and a double click is not an error.

### Read

`ShipmentInvoicesDto` gains `Confirmations: List<ShipmentInvoiceConfirmationDto>`, one entry per
client that has a record, `{ clientId, number, isReady }`. A client with no record is simply absent;
the frontend reads that as "unready, no number yet".

Kept off `ShipmentInvoiceDto` deliberately: it is a property of the client's row, and repeating it
on each of a client's invoices would invite the two to disagree.

## The export file

`ShipmentExportInvoice` gains `Number`. `ShipmentExportQuery` keeps only the invoices of clients
whose confirmation is ready, and orders the result by that number.

Each section also gains what the deleted stop sheets used to carry — but on the **party**
(`ShipmentExportInvoiceParty`, one per ordering client) rather than on the invoice:

- `AddressLine` / `DeliveryPlaceName` — resolved from that client's stop on the run, mirroring
  `resolveDetailStopAddress` / `stopForBand` in `shipmentInvoiceModel.ts`; null for a client with no
  stop of its own
- `Notes` — the order's notes behind that stop
- `Returns` — the vratky handed back there

Without this the returns and the delivery notes leave the file entirely along with the stop sheets.

Per party, not per invoice, because of the groups: a payer's sub-clients are parties inside its
invoice and have no section of their own, so an invoice-level address would print the payer's — or
nothing, since a pure payer has no stop — and drop every sub-client's delivery note and vratka. For
an ordinary single-party invoice the two are identical. A client with two stops on one run takes the
first, exactly as the screen does.

The invoice keeps one address of its own: the payer's official (billing) address, which the screen
also shows on a payer band, and which the existing billing-recipients section already sets a
precedent for.

### Excel (`ShipmentExportWorkbookBuilder`)

`WriteOverviewSheet` and `WriteStopTable` are untouched, including their stop count, client count
and run totals — the route table stays the driver's page and lists every stop, ready or not.

`WriteStopSheet`, `SheetNameFor` and the sheet-name de-duplication go, along with
`ShipmentExportModel.SheetStops`. `WriteInvoiceSheet` writes a section per ready client in number
order; its existing "omit the sheet entirely when the split is empty" rule now also covers the
run with nothing confirmed.

### Word (`ShipmentExportDocumentBuilder`)

`WriteStopPage` goes. `WriteOverview` is untouched; `WriteInvoicePages` gains the number, the
address, the notes and the returns table.

### Headings and labels

`ShipmentExportLabels.InvoiceHeading` becomes `{Number} · {ClientName}`, keeping its existing
`· Faktura {Sequence}` suffix only for a client holding more than one invoice on the run. Both
writers keep sharing it, for the reason they always did.

### Dead code this removes

`ShipmentExportProduct.InvoicedQuantity`, `ShipmentExportStop.TotalInvoicedQuantity` and
`ShipmentExportQuery.InvoicedQuantityFor` exist for the stop sheets' delivered-vs-billed pair and
have no other reader once those sheets are gone; they are deleted rather than left dangling. With
them go the two lookups that fed them (`InvoicedSplit.ByPayer`, `ByPayerAndOrderer`) and the
cross-billed-in rows a stop table used to append. `LoadInvoicedItemsAsync` stays — the invoice
sections are built from its split.

`ShipmentExportStop` is trimmed to what the route table actually reports — order, client or label,
warehouse flag, town, products — since street, city line, delivery place, notes, returns and
"invoiced to" now travel on the party. `RawStop.PayerId`/`PayerName` and
`RawProduct.SourceKind`/`SourceItemId` fed only the deleted attribution and go with it.

## Frontend

`ClientBand` gains `number?: number` and `isReady: boolean`, filled by `toBands` from the new
`confirmations` list. Bands keep sorting by route order.

The band header's round badge shows the confirmation number, or `–` while the row is unready; the
route position moves into the address line (`Zastávka 2 · …`) rather than being dropped, since it is
still how the office and the driver talk about a stop.

Beside the billing chip sits a `Hotovo` checkbox, rendered only when `canEdit`, driven by
`useSetInvoiceReadiness` in `useShipmentInvoices.ts` — same shape as the other three mutations
there, invalidating `qk.shipmentInvoices` on success. A ready row is otherwise unchanged: every
control stays live, because a mistake found after marking has to be fixable without a special path.

The API client is regenerated (`yarn generate-api`) in the same commit as the backend change.

## Testing

Backend:

- `SetInvoiceReadinessTests` — assigns 1 then 2 across two clients; un-mark keeps the number and
  re-mark returns it; a third client marked after an un-mark takes 3, since an un-marked row still
  holds its own number; 404 for
  a client with no row; 400 on a delivered run; idempotent repeat.
- `ShipmentExportQueryTests` — unready clients absent from `Invoices`; ordering by number, not by
  route; address, notes and returns resolved onto each party, including a group where the payer has
  no stop and two sub-clients have their own; stops still present for the overview.
- `ShipmentExportWorkbookBuilderTests` / `ShipmentExportDocumentBuilderTests` — no per-stop sheet or
  page; overview unchanged; numbered headings; a run with nothing ready produces the overview alone.

Frontend: `shipmentInvoiceModel.test.ts` for the new band fields; `ShipmentInvoicing.test.tsx` for
the badge's number and `–`, the checkbox firing the mutation, and its absence when `canEdit` is
false.

Gate: `dotnet test` (full suite), `yarn generate-api`, `yarn lint`, `yarn test`.

## Out of scope

- Locking a ready row against edits — decided against; revisit only if the office actually edits
  confirmed rows by accident.
- Any change to the route table, the nakládka, or the order module.
- Private pieces in the export. They are absent today and stay absent; readiness does not change
  what a private-only client contributes to the file (nothing).
