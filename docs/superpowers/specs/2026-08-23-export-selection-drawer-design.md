# Choosing what goes into the export, and remembering what went

**Date:** 2026-08-23
**Status:** Implemented
**Branch:** `feature/invoice-row-readiness`
**Extends:** `2026-08-23-invoice-row-readiness-design.md`

## Problem

Confirming a row puts it in the export file and keeps it there. On a run confirmed over a morning
that means every download carries the rows that already went out with the last one, and nothing
records which those were — so the office cannot tell a fresh section from a duplicate, and the only
way to send one client's invoice is to send everybody's again.

## Decisions

| Question | Decision |
|---|---|
| What is remembered | `last_exported_at` per confirmed row — a timestamp, not a flag |
| Re-export | Refreshes the timestamp; the last export wins |
| What the export takes | An explicit list of clients, chosen in a drawer |
| Preselection | Rows never exported. All exported already → nothing ticked, buttons disabled |
| Already-exported rows | Listed, tinted, stamped with when they went — and tickable |
| Unconfirmed rows | Not listed. They have nothing in the file |
| Export verb | `POST`, both formats — they now take a list and write |
| Export permission | Stays `Shipments: View` |
| Export visibility | Gated on the `Invoicing` capability |
| Format choice | Two buttons at the foot of the drawer, replacing the header's format menu |

### Rejected alternatives

**A boolean `is_exported`.** Answers less for the same column. The drawer wants to say *when* a row
went out — "Exportováno 23. 8. 21:40" is what tells the office whether the file on their desk is the
one that carried it.

**Keeping `GET` and passing the selection as a repeated query parameter.** A GET that writes was
already a wart on the invoices read; adding a second one to carry `?clientIds=…&clientIds=…` makes
the endpoint both a writer and awkward to call.

**Stamping only when the exporter has Edit.** Would silently produce an unstamped file for a
view-only user, so the next person's drawer would offer rows that have already gone out. The stamp
is a fact about the file, not about who asked for it.

**Requiring Edit to export at all.** Export is View-gated on purpose: the office needs the file for
runs it may no longer change.

## Data model

`OutgoingShipmentInvoiceConfirmation` gains:

| Column | Notes |
|---|---|
| `last_exported_at` | UTC instant of the most recent export that carried this row; null until one does |

Migration `AddInvoiceConfirmationExportStamp` — additive, no data move. Existing confirmed rows come
out never-exported, so the first drawer on an in-flight run offers all of them. That is right: no
file this feature can account for has gone out yet.

Nothing clears the stamp. Un-ticking a row leaves it, because the file that carried it still exists;
re-confirming and re-exporting simply refreshes it.

## Backend

### The export endpoints

`POST outgoing-shipments/{Id:guid}/export/excel` and `…/export/word`, body:

```jsonc
{ "clientIds": ["<guid>", "…"] }   // the confirmed rows to carry
```

`Shipments: View` + `Capability.Invoicing` — the capability is new on these two, and matches what the
file now is: the invoice split. Both keep their binary response and their server-side file name.

Handler order is load → build → stamp → save → send. Stamping after the build is what keeps a run
whose file failed to generate from reading as exported.

Guards:

- 404 when the shipment does not exist.
- 400 when `clientIds` is empty (the validator's job) or names a client with no **confirmed** row on
  the run. Dropping it silently would hand back a file missing a section the caller asked for, which
  is the one failure the office cannot see.

`ShipmentExportQuery.LoadAsync` takes the selection and narrows its existing filter from "rows that
are ready" to "rows that are ready **and** chosen". Passing no selection keeps the old meaning —
every ready row — which is what the query's own tests read.

The stamp is written through the shipment's `InvoiceConfirmations` navigation, tracked, so the export
needs no second load: it is the same graph `ShipmentInvoiceGraph.LoadReadOnlyAsync` already reads for
the split — with one difference, that read is untracked on purpose. The endpoint therefore stamps
from its own tracked read of the confirmations, keyed by client, rather than from the export model.

### Read

`ShipmentInvoiceConfirmationDto` gains `LastExportedAt`, so the drawer reads the invoices query the
Fakturace card has already cached rather than a new endpoint.

## Frontend

`ExportSelectionDrawer` — a new sibling of `ShipmentInvoicing`, opened by the header's Export button
(the format menu goes; the two formats become buttons at the drawer's foot).

Rows come from `toBands` filtered to `isReady`, in the same number order the table and the file use.
Each row shows its number, the client, its pieces and value, and — when it has one — when it was last
exported. Rows never exported start ticked; exported rows are tinted and tickable. Both format
buttons are disabled while nothing is ticked.

`useExportShipment` takes `{ id, format, clientIds }`. On success the drawer closes and the file
downloads exactly as it does today; the invoices query is invalidated so the stamps the export just
wrote reach the screen.

The Export button and the drawer are gated on `canSeeInvoicing`, the flag `ShipmentDetail` already
computes for the Fakturace card. A driver loses the export button, which is correct: the file is the
office's invoicing document, and the drawer's own query is capability-guarded server-side.

## Testing

Backend:

- `ExportSelectionTests` — the selection narrows the invoice sections; the stamp lands on exactly the
  chosen rows; re-exporting refreshes it; both formats stamp alike; an empty selection, an
  unconfirmed client and a since-unticked row are all 400; an unknown shipment is 404 and stamps
  nothing.

  Not covered: that a build which throws stamps nothing. The ordering in the handler is what
  guarantees it and there is no cheap way to make the writers fail on a valid model — worth a test
  the day one of them can.
- `ShipmentExportQueryTests` — a selection excluding a confirmed row leaves it out of `Invoices`; no
  selection still means every confirmed row.
- The confirmations DTO carries `lastExportedAt`.

Frontend: the drawer preselects un-exported rows, lists exported ones with their date and lets them
be ticked, disables both buttons on an empty selection, and hands the ticked ids to the format
chosen. `ShipmentDetail` opens the drawer instead of exporting straight away, and shows no Export
button without the capability.

Gate: `dotnet test`, `yarn generate-api`, `yarn build`, `yarn lint`, `yarn test:run`.

## Out of scope

- Any marker on the Fakturace table itself — the export state is read in the drawer. Worth revisiting
  once the office has used it.
- Clearing or invalidating a stamp when a row's contents change afterwards. The office can see the
  date and re-tick the row; guessing that an edit invalidates a file we do not hold is a bigger
  decision than this change.
- The route table on the file's first page, which still lists the whole run.
