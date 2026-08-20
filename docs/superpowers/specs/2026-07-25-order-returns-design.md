# Move Vratky (returns) from outgoing shipments to orders

**Date:** 2026-07-25
**Status:** Approved, ready for implementation

## Problem

Returnable items ("vratky" — empty kegs, bottles, crates the client hands back)
are currently attached to the **outgoing shipment**. That is the wrong owner: a
return is something a *client* gives back against *their order*. Hanging it on
the shipment means it cannot be planned when the order is taken, it is lost if
the order is re-planned onto a different shipment, and it cannot be attributed
to a client when a shipment serves several.

## Decision

Returns become a nested collection on **Order**. The outgoing shipment detail
**displays** the returns of the orders on its route, grouped by stop, and has no
write path for them at all.

Settled during design:

| Question | Decision |
|---|---|
| When is a return entered? | **Planned up front**, with the order. One quantity, no planned-vs-actual split. |
| What identifies the item? | **Free-form name**, as today. No catalog/product link. |
| Extra fields | An optional **note** per return row (new). |
| Shipment presentation | Own "Vratky" card, **grouped by client** (one group per order stop, route order). |
| Existing data | **Dropped.** No back-fill — the current rows are dev/demo only. |

### Accepted consequences

1. **Custom stops can no longer carry returns.** A custom waypoint has no order,
   so it has nowhere to hang one. Correct for the domain; noted as a real
   capability removal.
2. **The shipment editor loses its Vratky block.** Returns are editable only in
   the order editor.

## Data model

New entity `OrderReturn` → table `order_returns`, mirroring `OrderItem`:

| Column | Type | Notes |
|---|---|---|
| `order_id` | `long` FK → `orders` | cascade delete, like `OrderItems` |
| `name` | `varchar(200)` | free-form |
| `quantity` | `int` | > 0 |
| `note` | `varchar(500)`, nullable | new |

`Order` gains `ICollection<OrderReturn> Returns` with `DeleteBehavior.Cascade`.
Like `OutgoingShipmentReturn` today, it needs no `DbSet` — EF discovers it
through the navigation.

**Removed:** `OutgoingShipmentReturn` entity, `OutgoingShipment.Returns`,
`ShipmentReturnDto`, and the `Returns` property on the shipment Create / Update
/ Detail DTOs.

**Migration** `MoveReturnsToOrders`: drop `outgoing_shipment_returns`, create
`order_returns`. No back-fill.

## API

New `Features/Orders/Utils/OrderReturnDto.cs` — read/write DTO, `Id` set on read
and on updates of an existing row, null for newly added ones:

```csharp
public sealed record OrderReturnDto
{
    public Guid? Id { get; set; }
    public string Name { get; set; } = null!;
    public int Quantity { get; set; }
    public string? Note { get; set; }
}
```

- `CreateOrderDto.Returns` — created alongside `OrderItems`.
- `UpdateOrderDto.Returns` — add / update-existing / delete-missing **diff** by
  `PublicId`, the same shape as the `GetReturns` helper being deleted from
  `UpdateOutgoingShipmentEndpoint`. (Deliberately a diff rather than the
  clear-and-recreate that `OrderItems` uses in the same endpoint: it keeps
  `PublicId`s stable across saves.)
- `OrderDto.Returns` on the order Detail query.
- Validators (create + update): name not empty and ≤ 200; quantity > 0; note
  ≤ 500.
- Shipment Detail: `Returns` moves from the DTO root onto
  `OutgoingShipmentStopDto.Returns`, projected from `s.ClientOrder.Returns` —
  empty for custom stops. Read-only.
- Shipment Create/Update: `Returns` removed from DTO, endpoint and validator.

## Frontend

`api-client.ts` is regenerated (`yarn generate-api` against the local backend)
in the same commit as the backend change, per the repo's contract rule.

### `OrderEditor.tsx`

New "Vratky" card in the right sidebar, below "Košík". Add/remove rows like the
shipment editor block it replaces, but each row is two lines so the note has
room:

```
┌ Vratky                                    [+ Přidat] ┐
│ ┌──────────────────────────────────────────────────┐ │
│ │ [Např. prázdné sudy 50 l        ]  [ 12] [🗑]    │ │
│ │ [Poznámka (nepovinné)                          ] │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

Rows sit in a lightly bordered container so a two-line row does not visually
merge with the next. Empty state: *"Žádné vratky. Přidejte položky, které klient
vrací (prázdné sudy, lahve…)."* Returns join `serializeForm`'s snapshot so the
unsaved-changes guard covers them.

### `OrderDetail.tsx`

Read-only "Vratky" card below "Položky", same row shape as Položky (name bold,
note as the caption line beneath, `{quantity}×` right-aligned). Rendered only
when the order has returns.

### `ShipmentDetail.tsx`

The existing Vratky card keeps its slot (below `OrdersOverviewCard`) but is fed
from `shipment.stops[].returns`. One group per order stop that has returns, in
route order, headed by the client name with the `colorForClient` dot already
used in the orders-overview card. Grouping is per **stop**, not per client id —
two orders for one client on one route read as two groups, which is what the
driver walks. Card hidden when no stop has returns.

### `ShipmentEditor.tsx` / `shipmentDraft.ts`

The Vratky card, `DraftReturn`, the `returns` state and its `serializeShipment`
argument are removed, as is `returns` on the draft type and mapper.

## Testing

**Backend** (`AleTrack.Tests/Features/Orders/`):

- create order with returns persists them;
- update adds a new row, edits an existing one by id, and drops a missing one;
- validator rejects a blank name, a name > 200, quantity ≤ 0, and a note > 500;
- order detail projects returns incl. the note.

In `Features/OutgoingShipments/`:

- shipment detail projects per-stop returns, and an empty list for a custom stop;
- the returns assertions in `UpdateOutgoingShipmentTests` are deleted with the
  write path.

**Frontend:**

- `OrderEditor` — add / edit / remove a row including its note, and the
  unsaved-changes baseline reacting to a return edit;
- `ShipmentDetail` — grouped-by-client render, and the card absent when no stop
  has returns;
- existing shipment-editor returns coverage removed.
