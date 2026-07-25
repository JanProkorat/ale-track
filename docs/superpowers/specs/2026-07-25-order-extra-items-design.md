# Move extra items from outgoing shipments to orders

**Date:** 2026-07-25
**Status:** Approved, ready for planning
**Precedent:** [`2026-07-25-order-returns-design.md`](2026-07-25-order-returns-design.md)

## Problem

Two of the three "extra item" kinds on an outgoing shipment are really additions
to a *client's order*, not to a route:

- **`OutgoingShipmentClientExtraItem`** — a *dokládka*: stock pulled from the
  inventory and delivered to a client on top of their order.
- **`OutgoingShipmentCustomExtraItem`** — a free-form billable item delivered to
  a client.

Both are billable, so when invoicing arrived each had a **nullable `ClientId`**
bolted on purely so the reconciler could attribute them. That nullable column is
the tell: the owner is wrong. The client is a fact about the item, but the schema
lets it be absent, and every consumer has to filter for it
(`ShipmentInvoiceReconciler.cs:264,277`, `ShipmentInvoiceGraph.cs:121,124`).

The third kind, **`OutgoingShipmentInventoryExtraItem`**, is stock the truck
brings *back to the depot*. It has no client and no order, and **stays on the
shipment**.

## Decision

`ClientExtraItem` and `CustomExtraItem` become nested collections on `Order`,
edited with the order. The shipment **displays** them and still drives their
loading confirmation, but can no longer create or delete them.

Settled during design:

| Question | Decision |
|---|---|
| Which kinds move? | Client extras and custom extras. Inventory extras stay on the shipment. |
| Where are they edited? | **Order editor only**, like vratky. The shipment's "Dokládka" dialogs are removed. |
| `ClientId` column | **Dropped.** The order carries the client. |
| Existing rows | **Dropped**, not back-filled. Invoice lines referencing them cascade away and the reconciler rebuilds each split on next read. |
| Loading confirmation | Stays a shipment action, writing through to the order's rows — exactly as `OrderItem` already works. |

### Accepted consequences

1. **The depot can no longer add a dokládka while packing the truck.** Any extra
   must exist on the order before the shipment is loaded. This is the real cost
   of the "order editor only" choice and was accepted explicitly.
2. **Manual invoice-line moves on affected shipments are lost** when the old rows
   are dropped, because the reconciler rebuilds the split from the load.
3. **A custom stop cannot carry extras** — it has no order. Same shape as the
   vratky move.

## Data model

Two new entities, mirroring the ones they replace minus the client column:

| Entity | Table | Columns |
|---|---|---|
| `OrderClientExtraItem` | `order_client_extra_items` | `order_id` (FK, cascade), `inventory_item_id` (FK, no action), `quantity`, `is_shipment_loading_confirmed` |
| `OrderCustomExtraItem` | `order_custom_extra_items` | `order_id` (FK, cascade), `description` (varchar 200), `quantity`, `is_shipment_loading_confirmed` |

`Order` gains `ICollection<OrderClientExtraItem> ClientExtraItems` and
`ICollection<OrderCustomExtraItem> CustomExtraItems`, both
`DeleteBehavior.Cascade`, joining `OrderItems`, `Returns` and `Notes`.

**Removed:** `OutgoingShipmentClientExtraItem`, `OutgoingShipmentCustomExtraItem`,
`OutgoingShipment.ClientExtraItems`, `OutgoingShipment.CustomExtraItems`, and the
`ClientExtraShipmentDto` / `CustomExtraShipmentDto` write DTOs.

**Kept unchanged:** `OutgoingShipmentInventoryExtraItem` and
`OutgoingShipment.InventoryExtraItems`.

**Migration** `MoveExtraItemsToOrders`: drop the two shipment tables, create the
two order tables. No back-fill.

## Invoicing

`InvoiceLineSourceKind` keeps both values — the *kind* of source is unchanged,
only its owner. `OutgoingShipmentInvoiceLine.ClientExtraItemId` and
`.CustomExtraItemId` re-point at the new tables.

`ShipmentInvoiceGraph` loads extras through `Stops.ClientOrder` instead of the
shipment root, and both it and `ShipmentInvoiceReconciler` **drop their
`ClientId is not null` filters** — the client now comes from `order.Client` and
is always present. This is a simplification, not just a port: the "not yet
attributed" state disappears from the model.

## Loading and stock

Two behaviours must survive the move.

**Loading confirmation.** The nakládka checklist is shipment work. It already
writes through to `OrderItem` via `ClientOrderShipmentDto.OrderItems`
(`{orderItemId, isLoadingConfirmed}`). Extras follow the identical pattern —
`ClientOrderShipmentDto` gains two parallel lists:

```csharp
public List<ExtraItemInfoDto> ClientExtraItems { get; set; } = [];  // { Guid Id, bool IsLoadingConfirmed }
public List<ExtraItemInfoDto> CustomExtraItems { get; set; } = [];
```

The shipment update may flip these flags; it may not add or remove rows. Rows
posted with an unknown id are ignored rather than created.

**Stock deduction.** `SubtractFromInventory` fires on the transition to Loaded
(`UpdateOutgoingShipmentEndpoint.cs:175`). It now iterates
`Stops.ClientOrder.ClientExtraItems` instead of `shipment.ClientExtraItems`.
Timing is unchanged: stock is taken at loading, not when the order is written.

Consequence: the order editor's availability check is **advisory**. Stock can be
gone by the time the shipment loads. That is already true today; moving the entry
point earlier only widens the window. No reservation mechanism is in scope.

`ResetOrderItemsForReuse` (shipment cancellation) must also clear the loading
flags on the order's extras, not just its items.

## API

- `CreateOrderDto` / `UpdateOrderDto` gain `ClientExtraItems` and
  `CustomExtraItems`, diffed by `PublicId` on update like `Returns` and `Notes`.
- `OrderDto` (detail) returns both. Client extras resolve the inventory item's
  name and package size for display; current stock level is **not** included —
  the editor reads live stock from `useInventory`, and a detail view showing a
  stale level would invite misreading it as a reservation.
- `OutgoingShipmentStopDto` gains both lists so the shipment detail can render
  and confirm them per stop, replacing the shipment-root
  `ClientExtraItems` / `CustomExtraItems`.
- New `Features/Orders/Utils/OrderExtraItemDtos.cs` + validators: quantity > 0;
  description not empty and ≤ 200; `inventoryItemId` must resolve.

## Frontend

`api-client.ts` is regenerated in the same commit as the backend change.

### `OrderEditor.tsx`

A "Položky navíc" card in the right sidebar, below Vratky, with two add paths:

- **Ze skladu** — `Combobox` over inventory stock, quantity capped at what is on
  hand, showing the product name and package size.
- **Vlastní** — free-form description + quantity.

Rows carry their kind, join `serializeForm`'s snapshot for the unsaved-changes
guard, and blank rows are dropped on save.

### `OrderDetail.tsx`

Read-only "Položky navíc" card under Vratky, hidden when empty, each row showing
name/description and `{quantity}×`. Counts toward `hasSidebar`.

### `ShipmentDetail.tsx`

The two "Dokládka" dialogs and their add buttons are removed. The nakládka rows
and their loading checkboxes stay, sourced from `stop.clientExtraItems` /
`stop.customExtraItems` rather than the shipment root. Inventory extras
(dokládka *to* the depot) are untouched.

### `shipmentDraft.ts`

`clientExtraShipments` and `customExtraShipments` move from the draft root into
each `clientOrderShipments` entry as confirm-only lists.

## Testing

**Backend:**

- create order with both extra kinds persists them;
- update adds / edits / drops each kind by id;
- validators: quantity ≤ 0, blank description, description > 200, unknown
  inventory item;
- order detail projects both kinds;
- shipment detail projects them per stop, empty for a custom stop;
- shipment update flips a loading flag through to the order's row, and **ignores
  an unknown id rather than creating a row**;
- transition to Loaded subtracts the order's client extras from inventory;
- cancellation resets the extras' loading flags;
- reconciler attributes both kinds to the order's client with no null filtering.

**Frontend:**

- `OrderEditor` — add from stock (capped at available), add custom, remove, and
  the dirty baseline reacting to an extras edit;
- `OrderDetail` — both kinds render, card hidden when empty;
- `ShipmentDetail` — extras render per client stop and the add dialogs are gone.

## Out of scope

Stock reservation at order time, and any change to
`OutgoingShipmentInventoryExtraItem`.
