# Order item notes, extra-item notes, and the history-tab sort order

Date: 2026-08-04
Branch: `feat/order-item-and-extra-notes` (off `dev`)

Three changes to the order editor, delivered together because two of them add the
same kind of field to two sibling tables and share one migration.

## 1 — The "Dříve objednané" tab is not in catalog order

### Problem

`OrderEditor.tsx` renders two catalog tabs. "Procházet dle pivovaru" passes its
products through `inDisplayOrder()` — the app-wide order from
`compareProductsForDisplay` (beer by degree, then package size, then name;
limonáda/merch/ostatní last). "Dříve objednané" renders the endpoint's flat
`recent` array untouched, so it lands in whatever order the projection produced.

### Change

`recentAll` is sorted through `inDisplayOrder()` before the search filter, so the
list and the `(n)` badge on the toggle agree on one order.

`groupByName` and `inDisplayOrder` move out of `OrderEditor.tsx` into a sibling
`orderCatalogModel.ts`. `OrderEditor.tsx` is past 900 lines, and `app/CLAUDE.md`
asks for the pure shaping logic to be split out past roughly 500 so it can be
tested without a rendering harness. No behaviour moves with them.

### Accepted pre-existing behaviour

`groupByName` keys on product name alone, so two breweries' identically-named
beers already merge into one `VariantCard`, coloured by whichever appeared first.
Re-sorting can change which one that is. Left as-is — grouping by
brewery + name is a separate change with its own visual consequences.

## 2 — A note on a *položka navíc*

### Data

`OrderCustomExtraItem.Note`: `string?`, `[MaxLength(500)]`, `[Column("note")]` —
the same shape as the existing `OrderReturn.Note`.

### Write path

`OrderCustomExtraItemDto` gains `Note`, and its validator a
`MaximumLength(500)` rule with `ErrorCodes.ValidationMaxLengthError`.
`CreateOrderEndpoint` and `UpdateOrderEndpoint.GetCustomExtras` carry it through
on both the new-row and the update-in-place branch.

### Read path

Free: `OrderDto.CustomExtraItems` and `OutgoingShipmentStopDto.CustomExtraItems`
both project this same DTO.

### UI

- Editor: the "Položky navíc" row becomes a boxed two-line row like a Vratka —
  description + quantity + delete on the first line, `Poznámka (nepovinné)`
  underneath.
- `OrderDetail`: caption under the extra's row, as return notes render today.
- `ShipmentDetail` (nákládka): caption under the extra's row, read-only.

## 3 — A note on a cart line (order item)

### Data

`OrderItem.Note`: `string?`, `[MaxLength(500)]`, `[Column("note")]`.

DTO fields: `CreateOrderItemDto.Note`, `UpdateOrderItemDto.Note`,
`OrderItemDto.Note`, `OutgoingShipmentOrderItemDto.Note`. `MaximumLength(500)` in
the create and update validators.

### The destructive-rebuild trap

`UpdateOrderEndpoint` replaces `order.OrderItems` wholesale (`Clear()` then
re-add), which hands out fresh row IDs.
`outgoing_shipment_invoice_lines.order_item_id` cascades, so running that rebuild
on a closed order once deleted the order's invoice lines outright. The guard is
`RequestChangesFrozenContent`: when nothing the comparison covers has changed, the
rebuild branch is skipped and the rows — and the invoice lines hanging off them —
survive.

That makes the note field genuinely awkward, in a way worth stating:

- `Note` is **excluded** from `RequestChangesFrozenContent`. Including it would
  make a note-only save look like a content change, entering the destructive
  rebuild and cascading away the invoice lines.
- Excluding it means the note cannot ride along in the rebuild either — a
  note-only save never enters that branch. So notes are applied by a separate
  unconditional step, beside `GetReturns` / `GetNotes` / `GetCustomExtras`: for
  each persisted `OrderItem`, take the note from the incoming line with the same
  `ProductId`.
- Match key is `ProductId`, which is unique per cart: the editor increments an
  existing line rather than appending a second one for the same product.

### Consequence: notes are not frozen content

On a loaded shipment, or a finished order, quantities stay frozen but an item
note can still be added — the same latitude order notes and return notes already
have. This is the point of the feature: the note has to be able to reach the
person loading the truck, who may well already be looking at a packed shipment.

### UI

- Editor: a note `IconButton` per cart row toggles a text field beneath it; the
  icon renders in amber when the line carries a note, and a line loaded with one
  starts open. `note` joins `CartLine` and `serializeForm`, so the
  unsaved-changes guard notices a note-only edit.
- `OrderDetail`: caption under the item row.
- `ShipmentDetail` (nákládka): caption under the order-item row, read-only.

## Migration

One migration, `AddOrderItemAndExtraNotes`, adding both nullable `note` columns.
Nullable with no default, so it is additive and needs no backfill.

## Tests

- `app/src/features/orders/orderCatalogModel.test.ts` — history products come out
  in degree order with soft drinks last, and same-name variants stay adjacent and
  size-ordered.
- Backend: a note-only save on a frozen order succeeds and persists the note
  without touching item IDs; an item note survives a quantity change on an
  editable order; both notes round-trip through create → detail.
- Frontend: the extras note field edits and marks the form dirty
  (`OrderEditorExtras.test.tsx`); the cart note reveal toggles and marks the form
  dirty.

## Verification

`dotnet-verify` for `api/**`, `react-verify` for `app/**`. The regenerated
`app/src/generated/api-client.ts` lands in the same commit as the DTO change —
regeneration needs the backend of *this* worktree on :8080.
