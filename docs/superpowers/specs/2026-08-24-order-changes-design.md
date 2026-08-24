# Změny objednávek — a client ledger for what actually happened

**Date:** 2026-08-24
**Status:** Designed
**Branch:** `feature/order-changes` (off `dev`)

## Problem

An order is planned, loaded, papered and driven out. Then reality happens: the client cannot make it
to the agreed address, the driver forgets to unload a pallet, the client pushes back more empties
than were expected — or fewer — or asks for four extra crates at the door.

None of it is recorded anywhere today. Money owed in either direction gets typed into an **order
note**, which cannot be filtered, cannot be closed, and is visible only to somebody who already
found that one order. Nobody can answer "what is still open with this client".

The deviations also have to survive into the *next* order: the missing pieces have to be delivered,
the money difference settled. Whoever builds that next order needs to see the open points before
they start filling the cart, not after.

## Decisions

| Question | Decision |
|---|---|
| Core model | Delta **beside** the order. The order stays the plan, so the printed document stays true |
| Owner | **Client**, not order. `order_id` is nullable — a debt can exist with no order behind it |
| Table | One: `client_ledger_entries` |
| Two kinds of row | `requires_follow_up` separates a debt from a mere record (address change) |
| Taxonomy | By **target** (what changed), not by event. Eight values, four of which share one code path |
| Money | Plain signed `decimal`, CZK only (the project has no multi-currency) |
| Resolution | Binary: open / assigned / resolved. No partial settlement |
| "Assigned" | `resolved_by_order_id` set while `resolved_at` is still null |
| Auto-close | When the settling order reaches `OrderState.Finished` |
| Cancellation | Cancelling *that order* clears the link. Cancelling the **shipment** does not |
| Entry point | One shared drawer, opened from a shipment stop, an order detail, or a client profile |
| Double-count guard | At most one **unresolved** quantity entry per `(order_id, target, line)`, enforced by a partial unique index. Saving is an upsert |
| Display | Inline diff on the real rows — old value struck through, new one highlighted, added and removed rows labelled |
| Colour | Never the only carrier of meaning. Every changed row also carries a text label or icon |
| Permission | `ModuleType.Clients`. Drivers cannot record — the dispatcher does |
| Address / date | Written **automatically** from the existing `OrderDeliveryAddressWriter` path, `requires_follow_up = false` |
| Invoice | Deltas feed `ShipmentInvoiceReconciler.BuildSources` **regardless of `resolved_at`** |
| Added products | New `InvoiceLineSourceKind.LedgerEntry = 4` |
| Money on the invoice | Never |
| Shipment export papers | Unchanged — they are printed before the run |
| Prerequisite | `UpdateOrderEndpoint` must **merge** `OrderItems` instead of rebuilding them. Own commit, before anything here |

### Rejected alternatives

**Two entities — an immutable log plus a ledger.** Conceptually cleaner: the log never changes, the
ledger has a lifecycle. Rejected because "the driver left 3 kegs behind" becomes *two rows for one
fact*, with a synchronisation rule between them. The split earns its cost only when one change must
spawn several open points, or one open point must aggregate several changes. Neither is in the
requirements, and adding the split later is a migration, not a rewrite.

**Reusing `ClientReminder`.** It already hangs off a client and already has `ResolvedDate`. Rejected:
`Reminder` is built around recurrence and an occurrence date, has no link to a line or a quantity,
and could feed nothing into the order editor. Overloading it would damage both features.

**An event-shaped enum** (`NotUnloaded`, `ExtraDelivered`, …). Rejected: "not unloaded" and
"delivered extra" are the same arithmetic with opposite signs, so every consumer would carry two
branches for one concept, and each new scenario would grow the enum. The user-facing wording is
derived from the sign instead.

**The order carrying actuals, the ledger carrying the plan.** Tempting, because the invoice would
then need no change at all — `BillableSource.Quantity = item.Quantity` would already be right.
Rejected: it inverts the chosen model, stops the order being the plan, and requires a written path
into a deliberately frozen order.

**Leaving the invoice on the plan and warning the operator.** Cheapest, and no risk in the invoicing
code. Rejected: it means recording deviations while still billing the plan. Correct invoices would
then depend on somebody remembering — which is exactly what the order-note status quo already fails
at.

**A stored balance on `Client`.** Rejected: a second truth that drifts from the rows it summarises.
The sum is computed.

## Prerequisite: `UpdateOrderEndpoint` must stop rebuilding order items

A fix on its own merits, landing **before** the ledger, in its own commit.

`UpdateOrderEndpoint` clears and re-adds `order.OrderItems` on every save of an editable order, so
every save hands out fresh row IDs. `OrderItem` carries three fields the order does not own
(`OrderItem.cs:62-82`):

```
is_shipment_loading_confirmed   set while packing, via SetLoadingState
quantity_from_inventory         set via SetOrderItemSourcing
inventory_item_id
```

`SetOrderItemSourcing` accepts writes while `PurchaseInvoiceSplit.IsEditable(shipment)` — state
`Created` — which is exactly when the order is still `contentEditable`. So today: the dispatcher
splits sourcing and ticks off loaded lines, then anybody saves that order (even for an unrelated
note) and all of it silently resets to default.

`GetCustomExtras` in the same file documents the very rule being broken: `IsShipmentLoadingConfirmed`
is "left alone — it belongs to the shipment, and an order edit must not un-confirm a loaded item".
Custom extras are merged, so they are protected. Beer lines are rebuilt, so they are not.

**The change.** Match posted lines to stored ones by `ProductId` — safe, and the file already argues
why: "the order editor increments an existing cart line rather than adding a second one for the same
product, so a product appears at most once".

```
stored + posted  ->  update Quantity and ReminderState in place; the row ID survives
posted only      ->  new OrderItem
stored only      ->  remove (its invoice line cascades too — correct, the item is gone)
```

`QuantityFromInventory` is **clamped**, not reset, reusing `SupplierGoodSourcing.Clamp` exactly as
`GetSupplierGoodItemsAsync` already does for supplier goods. The pattern to copy is in the same file,
so no new style is introduced.

**What must not break:**

- `RequestChangesFrozenContent` stays. It is the business rule ("a frozen order's content does not
  change"), not a guard against the cascade. Ceasing to be a guard does not retire the rule.
- `ApplyItemNotes` stays a **separate pass outside** the `contentEditable` branch. Item notes are
  deliberately writable at every order state ("on every save, at every order state"). Folding them
  into the merge, which sits inside the gate, would silently kill note editing on delivered orders.
- Removing a line still cascades its invoice line. A test asserts this, so nobody later reads
  "merge" as "nothing is ever deleted".

## Data model

`ClientLedgerEntry : PublicEntity`, table `client_ledger_entries`.

```
client_id              NOT NULL, Cascade      owner
order_id               NULL,     SetNull      provenance; NULL for a standalone debt
stop_id                NULL,     SetNull      provenance: which stop of which run
target                 NOT NULL               ClientLedgerEntryTarget
order_item_id          NULL,     SetNull      ProductQuantity
product_id             NULL,     SetNull      ProductQuantity
product_name           NULL                   snapshot, survives a retired product
supplier_good_item_id  NULL,     SetNull      SupplierGoodQuantity
custom_extra_item_id   NULL,     SetNull      CustomExtraQuantity
order_return_id        NULL,     SetNull      ReturnQuantity
line_name              NULL                   snapshot for the non-product lines
planned_quantity       NULL
actual_quantity        NULL
planned_text           NULL                   DeliveryAddress / DeliveryDate: the old value
actual_text            NULL                   ... and the new one
amount                 NULL   decimal(18,2)   Money; signed, + client owes us, - we owe client
note                   NULL
requires_follow_up     NOT NULL
resolved_at            NULL
resolved_by_user_id    NULL,     SetNull
resolution_note        NULL
resolved_by_order_id   NULL,     SetNull
created_at             NOT NULL
created_by_user_id     NULL,     SetNull
```

```csharp
public enum ClientLedgerEntryTarget
{
    ProductQuantity = 0,       // order_item_id + product_id
    SupplierGoodQuantity = 1,  // supplier_good_item_id
    CustomExtraQuantity = 2,   // custom_extra_item_id
    ReturnQuantity = 3,        // order_return_id
    DeliveryAddress = 4,
    DeliveryDate = 5,
    Money = 6,
    Other = 7
}
```

The difference between planned and actual is **never stored** — it is computed. A stored difference
is a third number that can stop agreeing with the first two.

`created_by_user_id` introduces a pattern this codebase does not yet have: no entity in `Entities/`
records its author. It is deliberate here — "who wrote this and when" is the first question a
disputed debt raises — and `IAppContext.UserId` (`Common/Utils/AppContext.cs:14`) already supplies it.

**Indexes.** `(client_id, resolved_at)`, the query behind both the client profile and the order
editor preview and therefore the hottest one. Plus the partial unique index enforcing the upsert
invariant: one unresolved entry per `(order_id, target, line id)`.

**When `requires_follow_up` defaults to true.** Not simply "whenever the numbers differ":

| Target | Short | Over |
|---|---|---|
| `ProductQuantity`, `SupplierGoodQuantity` | yes — pieces are owed | **no** — they are with the client and get billed |
| `ReturnQuantity` | yes — the client still owes empties | **yes** — we are holding deposits that are not ours |
| `CustomExtraQuantity` | yes | yes |
| `Money`, `Other` | yes | yes |
| `DeliveryAddress`, `DeliveryDate` | never — informational | never |

A return has no good direction, which is also why its over-delivery never gets the
affirmative colour that "delivered extra" earns.

**Two lookups, not one.** Conflating them double-bills, which the prototype demonstrated
before this was written down:

- *What was delivered on this line* — a permanent fact about that handover, so
  `resolved_at` is irrelevant. Feeds the inline diffs **and** the invoice. Prefer the
  unresolved entry, fall back to the most recent resolved one.
- *What is still open on this line* — unresolved only. Feeds the upsert, which may
  rewrite only a row nobody has settled. A settled row is history and gets a new row
  beside it, which is exactly what the partial unique index (`WHERE resolved_at IS NULL`)
  permits.

Using the open-only lookup for display is the silent-failure case: closing an entry would
restore the plan, and the pieces already billed short would be billed again in full.

**Pairing key.** Beer lines pair on `order_item_id`, stable once the prerequisite lands.
`product_id` + `product_name` remain as a display snapshot and as a fallback for the one edge case
where a line is removed and re-added — the FK goes null and the delta would otherwise surface as a
stray "added" row. Returns, custom extras and supplier goods pair on `PublicId`; those collections
are already merged by `PublicId` in `UpdateOrderEndpoint` and keep their identity.

**Deliberately absent:** any balance column on `Client`; any link to `Sale` (an unpaid garage sale
has its own truth in `SaleBillingDetails.PaidDate` and `SaleState.AwaitingPayment`); any partial
draw-down table.

## Backend

### Endpoints

Following `Features/Notes/` conventions (`Post("clients/{id}/notes")`, `Put("clients/notes/{Id:guid}")`):

```
GET    clients/{id}/ledger-entries?state=open|all     Clients : View
POST   clients/{id}/ledger-entries                    Clients : Edit   batch: an array of rows
PUT    clients/ledger-entries/{Id:guid}               Clients : Edit
DELETE clients/ledger-entries/{Id:guid}               Clients : Edit
PUT    clients/ledger-entries/{Id:guid}/resolution    Clients : Edit   { resolved, note }
```

Resolution is its own endpoint for the reason `SetShipmentStateEndpoint` spells out in its own
`remarks`: it is one transition, not a re-post of the whole object. It also reopens, so a mistaken
close is recoverable.

The POST is an **upsert**, not an insert. Per posted quantity row: rewrite the existing unresolved
entry for that line, or delete it when the actual returns to the planned value, or insert. Rows
where actual equals planned are never stored — the ledger holds no no-op rows.

The ledger never routes through `UpdateOrderEndpoint`, so `OrderMutability.IsContentEditable` is
untouched and the frozen-order guarantee is unchanged.

### Automatic entries for address and date

`OrderDeliveryAddressWriter.PropagateToStopAsync` (`OrderDeliveryAddressWriter.cs:65`) already
detects "the address changed under a live run" and stamps `AddressChangedAt` for stops whose shipment
is neither `Delivered` nor `Cancelled`. An entry with `target = DeliveryAddress`,
`requires_follow_up = false` and the old and new address text is written in that same branch. Same
for `RequiredDeliveryDate`.

The dispatcher therefore never types it twice, and `AddressChangedBanner` keeps working unchanged.
The ledger adds what the banner lacks: what the value was before.

### Resolution lifecycle

| State | Condition |
|---|---|
| open | `resolved_at` null, `resolved_by_order_id` null |
| assigned | `resolved_at` null, `resolved_by_order_id` set |
| resolved | `resolved_at` set |

The middle state is the safeguard. Closing the entry the moment somebody clicks "add to order" would
make the debt vanish if that order were later cancelled — the exact failure this feature exists to
prevent.

Auto-close hooks into `ShipmentStateTransition`, where an order already becomes `OrderState.Finished`
(`ShipmentStateTransition.cs:133`): entries whose `resolved_by_order_id` is that order get
`resolved_at` and a generated `resolution_note`.

Cancelling **that order** clears `resolved_by_order_id` and the entry returns to open. The hook is
`PublicEnumSoftlyDeletableEntity.SoftDelete()`, which flips state to `Cancelled`. Cancelling the
**shipment** must *not* clear it: that only frees orders back to `OrderState.New` for re-planning,
and the order still exists.

`Money` and `Other` have no delivery event and therefore no automatic branch. Manual only.

### The invoice

`ShipmentInvoiceReconciler` already has the machinery: `InvoiceAdjustmentKind` of `QuantityAdded`,
`QuantityRemoved` and `SourceRemoved`, the `diff = source.Quantity - assigned` computation
(`ShipmentInvoiceReconciler.cs:246`), re-balancing of already-split invoices, and a report back to
the user through `ReconcileResult.Adjustments`.

The plan enters the invoice at exactly three lines, one per source kind:

```
ShipmentInvoiceReconciler.cs:374   Quantity = item.Quantity   // OrderItem
ShipmentInvoiceReconciler.cs:395   Quantity = item.Quantity   // SupplierGoodItem
ShipmentInvoiceReconciler.cs:413   Quantity = item.Quantity   // CustomExtraItem
```

Each becomes the **effective** quantity: planned plus that order's quantity deltas.

**Deltas apply regardless of `resolved_at`.** Seven of ten delivered means an invoice for seven, and
it stays seven forever. The three that follow on a later order are billed on *that* invoice.
Resolution describes the client relationship; the invoice describes what came off the van. Letting a
closed entry restore the invoice to ten would bill those pieces twice.

**Added products** get `InvoiceLineSourceKind.LedgerEntry = 4` plus a fourth nullable FK on
`OutgoingShipmentInvoiceLine`. `BuildSources` needs a persisted item id
(`RequirePersisted(item.Id, ...)`), and a product the client took at the door has no order line, so
the ledger row becomes the billable source itself. The enum already retired value `1`, so appending
`4` is established practice here. This touches `ShipmentInvoiceSplit`, `ShipmentInvoiceReconciler`,
`ShipmentInvoiceMapper` and `ShipmentExportQuery` — the single largest piece of work in the feature.

**Money entries never reach the invoice.** They carry no piece and no unit price; billing them would
mean inventing price semantics for `Other`.

## Frontend

`ShipmentDetail.tsx` is 1 792 lines and `OrderEditor.tsx` 1 380, so no logic goes into either — only
rendering. New modules, mirroring the reason `unloadOrder.ts` gives for its own existence:

| File | Contents |
|---|---|
| `ledgerModel.ts` | `applyLedger(planRows, entries) -> DecoratedRow[]` plus label and format helpers |
| `LedgerEntryDrawer.tsx` | the shared recording drawer, three context modes |
| `LedgerPanel.tsx` | the client-profile tab body |
| `ClientOpenItemsPreview.tsx` | the order-editor preview |

`applyLedger` does not only decorate: it **appends** rows that exist as a delta but not in the plan,
so it returns a new array rather than mapping the old one. Both the order detail and `unloadOrder.ts`
call it, so the two screens cannot drift.

Enum values arrive from the server sometimes as a name and sometimes as a number; `src/lib/labels.ts`
carries an `xName()` / `xLabel()` pair per enum for exactly that reason.
`ClientLedgerEntryTarget` gets the same pair and is never compared raw.

### The recording drawer

| Opened from | Prefilled | Shows |
|---|---|---|
| a stop in the shipment's unload list | `client_id`, `order_id`, `stop_id` | plan-vs-actual over items and returns, plus free rows |
| an order detail | `client_id`, `order_id` (and `stop_id` if it has one) | the same |
| a client profile | `client_id` | free rows only (Money, Other) — there is no plan to diff |

The plan comes from `OutgoingShipmentStopItem` once the run is `Loaded` or beyond (that is what was
actually loaded), otherwise from `OrderItems`. The operator edits only the "actual" column.

Reopening the drawer after a save must show the **stored actual**, not the original plan — otherwise
the second save records a second delta and the debt doubles. That is what the upsert invariant and
its partial unique index exist to guarantee.

### Inline diff

| Row state | Rendering |
|---|---|
| `changed` | old value struck through, new one highlighted |
| `added` | whole row distinguished, label "Přidáno na místě" |
| `removed` | whole row struck through, label "Nevyloženo" |
| `unchanged` | untouched |

Applied to all the collections on the order detail (`OrderDetail.tsx:243-352`: Položky — products
*and* supplier goods — Vratky, Položky navíc) and to `UnloadLine` on the shipment detail. Address and
date the same way: old struck, new beside it.

Two constraints: colour is never the only signal (invisible to a colour-blind reader and in print),
and colours come from `theme.vars.palette.*` — this project runs MUI cssVars, and `theme.palette.*`
inside a callback breaks dark mode.

### Client profile

`clientDetailTab.ts` gains `'ledger'`. The tab carries its open count through the existing
`tabLabel()` helper, as Ceník and Připomínky already do (`ClientDetail.tsx:183`). `LedgerPanel` shows
**Nedořešeno** (newest first, with a computed money summary) and a collapsed **Historie**. The two
money directions are summed separately — "you owe me 500 and I owe you 500" is two things to settle,
not zero.

### Order editor

`ClientOpenItemsPreview` sits **above the cart**, so it is read before the cart is built rather than
at the save button. It reads through `useClientLedger(clientId, 'open')`, alongside the existing
`useClientProductHistory(clientId)` (`OrderEditor.tsx:541`).

Quantity rows carry an **"Přidat do objednávky"** action. Because resolution is binary, a short
delivery would silently close the whole debt, so the row shows **"dluh 3 ks · přidáno 2 ks"** and the
save asks about the shortfall. The operator either tops it up or knowingly closes it and opens a new
entry for the remainder.

### The card that stays

The order detail keeps a `CollapsibleCard title="Změny"`, but its role changes: the inline diff says
*what* is different, the card says *when, who and why*, and it is the only place `Money`, `Other` and
resolution state appear at all.

### No second banner on the shipment

`AddressChangedBanner` already occupies the top of the shipment detail. A second strip competing for
the same attention would cost the reader both. The highlight belongs to the stop it concerns.

### Nothing in the shipment export

`ShipmentExportModel` is unchanged. Those papers are printed before departure, and a deviation is by
definition something that happens afterwards.

## Testing

Backend, prerequisite (red before the fix):

1. Saving an order preserves `Id` and `PublicId` of untouched items.
2. Saving preserves `QuantityFromInventory`, `InventoryItemId` and `IsShipmentLoadingConfirmed`.
3. Reducing a quantity below `QuantityFromInventory` clamps it rather than discarding it.
4. Removing an item deletes its invoice line.
5. Invoice lines of untouched items survive a save.
6. An item note is still writable on a delivered order.

Backend, ledger:

7. The upsert invariant: a second save for the same line rewrites, never appends.
8. An actual returning to the planned value deletes the entry.
9. An address change under a live run writes a `DeliveryAddress` entry with `requires_follow_up`
   false, and leaves `AddressChangedAt` behaving as before.
10. Assigning to an order sets `resolved_by_order_id` and leaves `resolved_at` null.
11. That order reaching `Finished` resolves the entry.
12. Cancelling that order reopens it; cancelling the *shipment* does not.
13. `Clients : View` cannot write; `Clients : Edit` can.

Backend, invoice:

14. A negative delta trims the invoice and reports `QuantityRemoved`.
15. A positive delta on an existing line reports `QuantityAdded`.
16. An added product bills through `InvoiceLineSourceKind.LedgerEntry`.
17. Resolving an entry does **not** change the invoice.
18. A `Money` entry does not touch the invoice.
19. Every invoice's total equals the sum of its own rendered rows — a ledger-sourced line
    that is counted but cannot be resolved back to something displayable is the failure
    this catches.
20. A resolved entry still renders as a diff on its order's detail.

Frontend: `applyLedger` unit tests per row state, including the appended-row case; the drawer's
prefill after a previous save; the preview's shortfall warning; the tab count; a dark-mode render of
each row state.

## Sequencing

The prerequisite is its own branch-opening commit with its own tests. It touches code that owns
invoice lines, and invoicing in this project has already had one silent defect, so a regression must
be bisectable to a single diff rather than buried inside the new feature.

After that: entity and migration, then the write path (endpoints and drawer), then the read paths
(client profile, order detail, shipment detail), then resolution, and the invoice last — it is the
largest and the riskiest piece, and it benefits from everything above it already being provably
correct.

## Out of scope

- Partial draw-down of an entry (binary was chosen, with a chain of entries instead).
- Drivers recording deviations themselves — blocked on the User↔Driver row-level link, and a
  one-condition extension to one guard once that lands.
- Money entries reaching the invoice.
- Any change to the shipment export documents.
- A standalone module in the permission matrix; this rides on `ModuleType.Clients`.
