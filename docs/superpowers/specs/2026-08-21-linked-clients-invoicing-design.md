# Propojení klientů — one payer, many delivery points

**Date:** 2026-08-21
**Status:** Design approved, ready for implementation
**Branch:** `feat/nakladka-redesign-and-fixes` (a follow-up branch off `dev` is fine)

## Problem

A `Client` today is one indivisible thing: it has an official (billing) address,
it orders, it receives a delivery, and it gets an invoice.
`Client.OfficialAddress` is non-nullable (`Entities/Client.cs`), so every client
must carry a billing address whether or not anyone ever bills it.

That does not match a chain. A head office signs the contract and pays for
everything, and its pubs take the beer. The pubs have a street address the
driver needs and no billing identity at all — asking the office to invent an
official address for each one produces junk data, and issuing an invoice per pub
produces paperwork nobody wants.

Two consequences the current model cannot express:

1. **Vykládka** must keep showing each pub's own address — the van stops at the
   pub, not at the head office.
2. **Fakturace** must show one invoice per payer, with the pubs' goods listed
   under it, and the Word/Excel exports must carry the same split.

## Scope

**In:** `Client.OfficialAddress` becomes optional. A self-referencing
`InvoicingClient` relation, flat and one level deep. Client CRUD, detail, list
and form support for it. The invoice reconciler issuing the default invoice to
the payer. The Fakturace table's collapsed per-sub-client blocks. A new grouped
invoice section in both exports. A warning where a stop has no resolvable
address.

**Out, deliberately:**

- **Any accounting / ISDOC / invoice-number work.** `OutgoingShipmentInvoice`
  stays a split of a run, not a document. Nothing here emits an invoice.
- **Per-sub-client pricing.** `ClientProductPrice` keeps hanging off the client
  that orders. A payer's price list does *not* cascade to its sub-clients —
  that is a separate decision with its own migration.
- **Chains deeper than one level.** See Decisions.
- **Retro-regrouping shipments already split.** See *Pre-existing splits*.
- **Blocking a client save that has no address at all.** Explicitly rejected by
  the user in favour of a warning on the shipment — see *Addresses*.

## Decisions

| Question | Decision |
|---|---|
| Czech label for the relation | **Propojený klient** (the field on a sub-client). Reverse list on the payer: **Propojení klienti** |
| Where the redirect happens | **Server-side, in `ShipmentInvoiceReconciler`.** The invoice is opened for the payer and the line keeps `OrderingClientId`. Reuses the cross-billing path that already exists end to end |
| Relation depth | **One flat level.** A client with a payer cannot be a payer, and a client with sub-clients cannot be given one. No cycles, no recursion, "who pays" is always one hop |
| Must a payer have an official address | **Yes.** It is the address being invoiced — a payer without one defeats the feature |
| Deleting a payer | **Rejected** while any sub-client points at it (`DeleteBehavior.Restrict` plus an explicit 400) |
| Client with no address at all | **Allowed to save.** Surfaced as a warning on the shipment stop instead |
| Export shape | Per-stop sheets and sections unchanged, plus a **new grouped Fakturace part** per payer → per party, with subtotals and a payer total |
| Shipments already split | **Left alone.** The redirect applies to a split being materialised for the first time |
| New DTO fields on the invoice response | **None.** `ShipmentInvoiceLineDto.OrderingClientName` already carries what the UI needs |

### Rejected alternatives

- **Display-only grouping** — invoices stay per sub-client and the payer is only
  a UI grouping key. Rejected: "who is billed" would live in two places, and
  every consumer (the table, Word, Excel, any future accounting export) would
  re-derive the grouping independently and drift.
- **A `ClientGroup` entity.** A group would need its own name, its own address
  and its own screen, and the payer already has all three. A nullable FK on
  `Client` says the same thing with one column.
- **Requiring a `ClientDeliveryPlace` on every sub-client.** Semantically neat
  (a pub *is* a place) but forces a second entity before any order can be
  written, and the contact address already holds a street address.
- **Cascading the payer's price list to sub-clients.** Out of scope, and not
  obviously wanted — a chain may well negotiate per pub.

## Data model

`Entities/Client.cs`:

```csharp
public Address? OfficialAddress { get; set; }        // was: = null!

[Column("invoicing_client_id")]
public long? InvoicingClientId { get; set; }

/// The client that receives the invoices for this one's goods.
public Client? InvoicingClient { get; set; }

/// Clients whose goods are invoiced to this one.
public List<Client> InvoicedClients { get; set; } = [];
```

`Configurations/ClientConfiguration.cs` — the `OwnsOne(x => x.OfficialAddress)`
block is unchanged in shape: it already works for the nullable `ContactAddress`
directly below it, because EF reads an all-null column set as a null instance.
Add the relation:

```csharp
builder.HasOne(x => x.InvoicingClient)
    .WithMany(x => x.InvoicedClients)
    .HasForeignKey(x => x.InvoicingClientId)
    .OnDelete(DeleteBehavior.Restrict);

builder.HasIndex(x => x.InvoicingClientId);
```

**One migration** (`LinkedClientsInvoicing`): drop `NOT NULL` from every
`official_address_*` column on `clients`, add `invoicing_client_id` with its FK
and index. Review the generated SQL before applying — earlier migrations in this
repo had to be split when a single file touched too much at once for Supabase.
If the generated file mixes the `ALTER`s awkwardly, split it in two rather than
hand-editing one.

### Invariants (code, not schema)

New `Features/Clients/Utils/InvoicingClientResolver.cs`, shared by create and
update — the same reason `ClientDeliveryPlaceResolver` and
`OrderDeliveryAddressWriter` exist: these checks need the client row, which a
FluentValidation rule cannot reach.

`ResolveAsync(dbContext, clientPublicId, invoicingClientPublicId, ct) → long?`

1. `null` in → `null` out.
2. Target must exist (404 via `ThrowHelper.PublicEntitiesNotFound`).
3. Target must not be the client itself → 400.
4. Target must have `InvoicingClientId == null` → 400 (no chains downward).
5. Target must have a non-null `OfficialAddress` → 400.
6. The client being saved must have no `InvoicedClients` → 400 (no chains
   upward).

Rule 6 needs the client's sub-client count, so `UpdateClientEndpoint` loads it.
On create the client has none by definition.

Delete: `DeleteClientEndpoint` rejects with 400 when the client still has
sub-clients. `DeleteBehavior.Restrict` is the backstop, not the message — soft
delete would otherwise leave sub-clients pointing at a deleted payer.

## API

| Endpoint | Change |
|---|---|
| `POST /clients` | `CreateClientDto.OfficialAddress` → `AddressDto?`, new `Guid? InvoicingClientId` |
| `PUT /clients/{id}` | the same two changes on `UpdateClientDto`. A `null` clears the relation |
| `GET /clients/{id}` | `ClientDto.OfficialAddress` → `AddressDto?`, new `Guid? InvoicingClientId`, `string? InvoicingClientName`, `List<LinkedClientDto> InvoicedClients` (`{ Id, Name }`) |
| `GET /clients` | `ClientListItemDto` gains `Guid? InvoicingClientId` and `string? InvoicingClientName` — the list already resolves display names for same-name clients, so this rides along |
| `DELETE /clients/{id}` | 400 while sub-clients remain |

### Validation

`CreateClientDtoValidator` / `UpdateClientDtoValidator`: the official-address
rule becomes `.When(r => r.OfficialAddress != null)`, matching the contact rule
directly above it. Everything else about the relation lives in the resolver.

## Addresses

Three separate pieces, none of which blocks a save.

**1 — The order's address kind.** `OrderDeliveryAddressWriter.ApplyAsync`
already rejects `Contact` for a client with no contact address. Add the mirror:
reject `Official` for a client with no official address. On the frontend, the
order editor's default choice becomes `Official → Contact → first delivery
place` instead of the hardcoded `Official`, and the picker hides `Official` when
there is none — it already hides `Contact` the same way.

**2 — Fallback direction.** Two resolvers fall back Contact→Official only, and
would render a blank line for a null official address:

- `app/src/features/clients/deliveryAddress.ts` → `resolveFromAddresses`
- `Features/OutgoingShipments/Queries/Export/ShipmentExportQuery.cs` →
  `ResolveAddress`

Both gain the reverse: with no official address, fall through to the contact
address. Keep the two in step — they are documented as sharing one rule.

**3 — The warning.** When a stop's address resolves to nothing, vykládka's stop
header and the shipment editor's stop row show a warning icon with
`Klient nemá vyplněnou dodací adresu`. Derived on the frontend from the
addresses already present on `OutgoingShipmentStopDto` — no new backend field
and no new call. `resolveDetailStopAddress` returns an empty `addressText` in
exactly that case, so the check is one truthiness test at the two call sites.

## Invoicing

`ShipmentInvoiceReconciler` is the whole change. `BillableSource` gains:

```csharp
/// Client the invoice is issued to: the ordering client's payer when it has
/// one, otherwise the ordering client itself.
public required long PayingClientId { get; init; }

/// The paying client entity when the graph had it loaded. A fresh invoice's
/// navigation must be filled or the response maps a blank client name.
public Client? PayingClient { get; init; }
```

`CollectSources` sets
`PayingClientId = orderingClient.InvoicingClientId ?? orderingClientId`.
Everything downstream that currently groups or looks up by `OrderingClientId`
for the *invoice* switches to `PayingClientId`. The *line* keeps
`OrderingClientId` untouched. Concretely, in `ShipmentInvoiceReconciler.cs`:

- `billableClientIds` and the `GroupBy` that ensures every client has an invoice
- the "does this client already have an invoice" test
- `HomeInvoiceFor`, and its `BuildInvoice` / `NextSequenceFor` calls

`ShipmentInvoiceGraph` must `Include` the ordering client's `InvoicingClient` —
its `PublicId` and `Name` are what the mapper reads — on both the read-only and
the write-path loads. A missed `Include` here shows up as a blank client name on
the Fakturace band rather than as an exception, so it gets a test of its own.

Nothing else moves. `MoveInvoiceLine`, private lines, adjustments and
`ShipmentInvoiceMapper` already treat payer ≠ orderer as normal.

### Pre-existing splits

Reconciliation keeps any invoice that still has lines. A shipment split before
this change therefore keeps its per-sub-client invoices, and only a split being
materialised for the first time gets the payer's invoice. This is deliberate:
re-pointing invoices under a shipment mid-run would move money between clients
without anyone asking. Assert it — a shipment with an existing sub-client
invoice must reconcile to the same shape.

## Frontend

**`ClientFormDrawer`** — a "Propojený klient" autocomplete. Options exclude the
client itself and clients that already have a payer. They do **not** exclude a
client that is already a payer for somebody else — one payer with many
sub-clients is the whole point, so a payer must stay selectable. The "no chains
upward" rule constrains the *subject* instead: a client that already has
sub-clients cannot be given a payer, so its picker is disabled with an
explanation rather than the option list being filtered. The official-address
fields stop being required. Selecting a payer does not hide the official address
(a sub-client may still have one), but the helper text says it is optional.

**`ClientDetail`** — a sub-client shows `Propojený klient: <name>` linking to
the payer. A payer shows a `Propojení klienti` list. The official-address card
gets an explicit empty state rather than rendering an empty `AddressBody`;
`ClientDetail.tsx` already guards on `client.officialAddress`, so this is a
message, not a crash fix.

**`ClientsPage`** — the address column falls back to the contact address, and a
sub-client's row carries a small chip naming its payer.

**`shipmentInvoiceModel.ts`** — new `invoiceParties(invoice)`:

```ts
export interface InvoiceParty {
  clientId: string
  clientName: string
  /** True for the paying client's own lines, which sort first. */
  isPayer: boolean
  quantity: number
  value: number
  groups: LineGroup[]
}
```

Built by partitioning `invoice.lines` on `orderingClientId`, then running each
partition through the existing `groupLineList`. Returns a single party when the
invoice has one ordering client, so ordinary invoices are unaffected.

**`ShipmentInvoicing.tsx`** — when `invoiceParties` yields more than one party,
the invoice body renders party rows (name · ks · value) that collapse in place
over their product rows, **expanded by default**. Reuses the existing
`collapsed: Set<string>` pattern, keyed `` `${invoiceId}:${clientId}` ``, and
the existing expand-all / collapse-all control extends to them. The payer's band
header gains an `N propojených klientů` chip. A move stays available on the
expanded product rows, unchanged — `LineGroup.parts` still names the source.
This also matches the Excel export, which opens expanded too since ClosedXML
cannot round-trip a collapsed row group (see "Found during implementation").

## Exports

**`ShipmentExportModel`** gains an additive part:

```csharp
/// Invoice split of the run, one block per paying client. Additive: the stop
/// entries are untouched, because the driver's view did not change.
public List<ShipmentExportInvoice> Invoices { get; init; } = [];

public sealed record ShipmentExportInvoice
{
    public required string PayingClientName { get; init; }
    public int Sequence { get; init; }
    public List<ShipmentExportInvoiceParty> Parties { get; init; } = [];
    public int TotalQuantity => Parties.Sum(p => p.TotalQuantity);
}

public sealed record ShipmentExportInvoiceParty
{
    public required string ClientName { get; init; }

    /// The paying client's own goods — listed first.
    public bool IsPayer { get; init; }

    public List<ShipmentExportProduct> Products { get; init; } = [];
    public int TotalQuantity => Products.Sum(p => p.Quantity);
}
```

Party product rows use `Quantity` for the billed pieces and leave
`InvoicedQuantity` null — inside an invoice block there is only one number.

**`ShipmentExportQuery`** builds them from the split `LoadInvoicedItemsAsync`
already reconciles. That method's return widens to carry the invoice and the
ordering client alongside the quantity, rather than doing a second load.

This closes a live gap: cross-billed rows are only appended to a client that
*has* a stop, so a paying client with no delivery of its own appears nowhere in
today's export.

**The per-stop `Fakturačně` column** keeps its meaning under one extended rule:

- client with no payer → unchanged (lines on its own invoices, whatever their
  orderer), so the manual-move semantics documented on
  `ShipmentExportProduct.InvoicedQuantity` are preserved exactly;
- sub-client → lines on **its payer's** invoices whose orderer is this stop's
  client, and the sheet or section prints `Fakturováno na: <payer>` under the
  address.

**`ShipmentExportWorkbookBuilder`** — a new `Fakturace` sheet: a heading row per
payer, then each party's rows wrapped in a real ClosedXML row group
(`sheet.Rows(from, to).Group()` then `.Collapse()`, ClosedXML 0.105.1) so the
file opens collapsed and expands in place, a party subtotal row, and a payer
total. Verify the grouping API against 0.105.1 before committing to it. If
`Collapse()` does not survive a round-trip, fall back to plain subtotal rows and
record that here rather than shipping a sheet that opens expanded.

**`ShipmentExportDocumentBuilder`** — a matching `Fakturace` section: a heading
per payer, a nested table per party reusing the existing product-table builder,
a subtotal row per party, and a payer total. Word has no collapsing, so the
subtotals carry the structure.

Labels go in `ShipmentExportLabels.cs` alongside the existing `Skutečně` and
`Fakturačně` strings.

## Testing

Backend (`dotnet test`, no DB — `Moq.EntityFrameworkCore`):

- **Reconciler** — a sub-client's items open an invoice for the payer with the
  line keeping its orderer; two sub-clients of one payer land on one invoice; a
  pre-existing sub-client invoice is left alone; a sub-client that also has its
  own stop still gets that stop; a missing `InvoicingClient` include surfaces as
  a blank name (guard test).
- **`InvoicingClientResolver`** — null passthrough, unknown target, self,
  target that already has a payer, target without an official address, client
  that has sub-clients.
- **Client CRUD** — create and update with a null official address, delete
  blocked while sub-clients exist, list and detail carrying the new fields.
- **`OrderDeliveryAddressWriter`** — `Official` rejected for a client without
  one.
- **Export** — invoice blocks per payer with parties in payer-first order; a
  payer with no stop of its own still appears; a sub-client stop's `Fakturačně`
  counts its own pieces and the sheet names the payer; the manual cross-billing
  case is unchanged.
- **Builders** — workbook sheet present with grouped rows and correct totals,
  document section headings with nested tables and totals.

Frontend (`react-verify`):

- `invoiceParties` — a single party for an ordinary invoice, payer-first ordering,
  per-party quantity and value, product merging inside a party.
- `ShipmentInvoicing` — parties expanded by default, collapsing hides rows,
  expand-all/collapse-all covers them, a move still works from an expanded row.
- Vykládka and the shipment editor — the warning appears exactly when the
  address resolves to nothing.
- `ClientFormDrawer` — payer options exclude self, payers and sub-clients;
  saving with no official address succeeds.
- `ClientsPage` / `ClientDetail` — payer chip, `Propojení klienti` list, empty
  official-address state.

`yarn generate-api` against a local backend on **:8080** in the same commit as
the DTO changes (`app/CLAUDE.md`), then the full `dotnet test` and
`react-verify` suites — not a filtered slice.

## Found during implementation

**The Fakturace sheet opens expanded, not collapsed.** The Exports section above
prescribed `sheet.Rows(from, to).Group()` then `.Collapse()` so the file "opens
collapsed and expands in place." A probe against the pinned ClosedXML 0.105.1
established that `OutlineLevel` survives a save/reload round-trip but the
`IsHidden` flag `.Collapse()` sets does not. The fallback this section itself
anticipated was taken: plain `.Group()` plus the subtotal rows, no `.Collapse()`
call, and no test asserting a collapsed sheet. Excel still shows the outline
controls, so a reader collapses each client's detail by hand; no data is
affected.

**The invoice blocks are per invoice, not per paying client.** The Decisions
table and this section both describe the Fakturace part as "one block per
paying client" / "per payer." During implementation this changed to one block
**per invoice**: the add-invoice and move-line endpoints let one client hold
several invoices on a single run, and merging them into one block would
discard a split the office deliberately made by moving lines. A client with
one invoice still renders as one block, so the common case is unaffected;
`ShipmentExportInvoice.Sequence` now carries each invoice's real position and
is read by the block ordering.

## Known gaps

- A payer's price list does not reach its sub-clients (out of scope above). If
  the office expects chain-wide pricing, that is the next slice.
- The relation is flat by construction. A franchise-of-franchise would need
  recursive resolution and cycle detection; the invariants are written so that
  loosening them later is an additive change.
- Reports (`Features/Reports/**`) still attribute by ordering client. Whether
  "client volume" should roll sub-clients up under their payer is an open
  product question, deliberately untouched here.
