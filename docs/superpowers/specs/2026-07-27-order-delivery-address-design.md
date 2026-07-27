# Order delivery address (Adresa doručení na objednávce)

**Date:** 2026-07-27
**Scope:** Full-stack. The delivery destination moves from being a
shipment-planning decision to a property of the order itself, chosen when the
order is created or edited and displayed on the order detail. The
outgoing-shipment stop inherits it and stays overridable.
**Builds on:** `2026-07-25-client-delivery-places-design.md`, which introduced
`ClientDeliveryPlace` and the three-way address choice on the shipment stop.

## Goal

Today the only place to say where an order is delivered is the outgoing-shipment
stop. `ShipmentEditor.tsx:355` hardcodes every newly-added order stop to
`Official`, so the planner re-picks the destination on every shipment — even
though the client already said where when they placed the order.

The address belongs to the order. The operator taking the order should record
it there, the order detail should show it, and the shipment should inherit it.

## Decisions taken during design

**The order decides; the stop inherits and may override.** The alternatives were
making the order the only place to choose (a planner rerouting one delivery
would have to go edit the order) or leaving the order-level value display-only
(two fields that silently disagree). Inheritance-with-override matches how the
work actually flows: the client says where when ordering, the planner may still
reroute on the day. Cost: a flag on the stop to remember that an override
happened, and a propagation path from the order write to the stop.

**An order edit propagates to a stop that has not been overridden.** A frozen
snapshot was rejected: the client phones in a new address, the operator edits
the order, and the driver still goes to the old one. Propagation is bounded —
only stops on shipments that are neither `Delivered` nor `Cancelled`.

**The change is announced even when it did not propagate.** A stop the planner
overrode keeps its own address, but the shipment still raises a banner saying
the order now disagrees with it. This is the more valuable of the two warnings:
the auto-updated case is already correct, the diverged case is the one nobody
would otherwise notice.

**`is_address_overridden` is derived on the backend, not sent by the client.**
The shipment write endpoints already receive the stop's chosen kind and place;
comparing that against the order's own choice yields the flag. Sending it from
the frontend would add a field to `ClientOrderShipmentDto` that two editors
would have to keep honest, and a stale one silently disables propagation.

**`OutgoingShipmentStopAddressKind` is renamed to `DeliveryAddressKind`.** The
enum is now carried by `Order` as well as `OutgoingShipmentStop`; keeping the
stop-specific name on an order property is actively misleading. Members and
numeric values are unchanged, so there is no data migration — it is a rename
across ~12 backend files plus `labels.ts`, `stopAddress.ts` and the regenerated
client.

**The order-level choice is non-nullable, defaulting to `Official`.** A nullable
"not specified" would force every read path to answer "then what?" — and the
answer would always be the billing address. Existing orders migrate to
`Official`, which is exactly what they effectively had.

## Data model

### Changed: `Order`

```
delivery_address_kind      integer NOT NULL DEFAULT 0   -- DeliveryAddressKind
client_delivery_place_id   bigint  NULL                 -- FK → client_delivery_places(id) ON DELETE RESTRICT
```

`ClientDeliveryPlace` navigation on `Order`, `[DeleteBehavior(DeleteBehavior.Restrict)]`,
mirroring `OutgoingShipmentStop.ClientDeliveryPlace` — and like it, **not**
filtered on `IsDeleted`, so an order pointing at a since-removed place keeps
rendering its address.

### Changed: `OutgoingShipmentStop`

```
is_address_overridden  boolean     NOT NULL DEFAULT false
address_changed_at     timestamptz NULL
```

`is_address_overridden` means "the planner chose an address other than the one
the order says", and is what suppresses propagation. `address_changed_at` is
stamped when an order edit changed the address under an active shipment; it is
what the banner reads, and clearing it is the acknowledgement.

### Changed: `DeliveryAddressKind`

`Common/Enums/OutgoingShipmentStopAddressKind.cs` →
`Common/Enums/DeliveryAddressKind.cs`. `Official = 0`, `Contact = 1`,
`DeliveryPlace = 2` — unchanged.

### Migration

Two columns on each of two tables, one rename with no column effect.

Backfill for existing stops:

```sql
UPDATE outgoing_shipment_stops
SET is_address_overridden = true
WHERE selected_address_kind <> 0 OR client_delivery_place_id IS NOT NULL;
```

A stop the planner deliberately moved off the default is treated as an override,
so the first order edit after this ships cannot stomp a decision that predates
the feature. Stops still on `Official` count as inherited — which for an order
that also defaults to `Official` is a no-op either way.

`address_changed_at` backfills to null: nothing has changed yet.

## Propagation

An order has at most one stop (`Order.OutgoingShipmentStopId`), so this is a
single-row update, not a fan-out. Only the update path has one: a freshly
created order is on no shipment, so `CreateOrderEndpoint` writes the two
columns and stops there.

In `UpdateOrderEndpoint`, after the new `(kind, placeId)` is applied and only
when it differs from the persisted one:

1. Load the order's stop and its shipment's state. No stop, or a shipment in
   `Delivered` / `Cancelled` → nothing further happens.
2. `is_address_overridden == false` → copy the order's kind and place onto the
   stop, stamp `address_changed_at`.
3. `is_address_overridden == true` → leave the stop's address alone, stamp
   `address_changed_at`.

Changing an order's **client** implies changing its address (the old place
belongs to the old client), so it takes the same path.

`address_changed_at` is cleared by:

- `POST outgoing-shipments/{id}/acknowledge-address-changes` — the banner's
  "Rozumím" action, clearing the stamp on every stop of that shipment.
- Any successful `UpdateOutgoingShipmentEndpoint` call — the planner has been
  looking at the banner while editing.

## API

### Orders

`CreateOrderDto` and `UpdateOrderDto` each gain:

```csharp
public DeliveryAddressKind DeliveryAddressKind { get; set; }   // defaults to Official
public Guid? ClientDeliveryPlaceId { get; set; }
```

Validation, in `CreateOrderValidator` / `UpdateOrderValidator`, mirroring
`ClientOrderShipmentDtoValidator` so the two surfaces cannot drift:

- `DeliveryAddressKind == DeliveryPlace` → `ClientDeliveryPlaceId` required.
- Any other kind → `ClientDeliveryPlaceId` must be null.
- `DeliveryAddressKind == Contact` → the client must have a contact address.

Endpoint-level DB checks (lookups, not validator rules): the place must belong
to the order's own client, and a soft-deleted place is rejected on a *new*
assignment while an order already pointing at one still saves. This is the same
logic `ShipmentStopDeliveryPlaceResolver` implements today; it is lifted into a
shared helper — `ClientDeliveryPlaceResolver` in
`Features/ClientDeliveryPlaces/` — that both the order endpoints and the
existing shipment resolver call, rather than being reimplemented.

`OrderDto` gains `OrderDeliveryAddressDto DeliveryAddress` — a resolved block,
so the detail screen needs no extra round trip and no client-side lookup:

```csharp
public sealed record OrderDeliveryAddressDto
{
    public DeliveryAddressKind Kind { get; set; }
    public Guid? PlaceId { get; set; }       // so the editor can re-select the choice
    public string? PlaceName { get; set; }   // set only for Kind == DeliveryPlace
    public string? PlaceNote { get; set; }   // the driver instruction
    public AddressDto? Address { get; set; } // the resolved destination
}
```

The place is projected **without** the `!IsDeleted` condition, matching the
shipment detail: a soft-deleted place still resolves on read.

### Outgoing shipments

- `OutgoingShipmentOrderDto` gains `DeliveryAddressKind DeliveryAddressKind` and
  `Guid? ClientDeliveryPlaceId`, which is what the editor pre-fills a new stop
  from. Its existing `ClientDeliveryPlaces` list is unchanged and still fills
  the picker.
- `OutgoingShipmentStopDto` gains `bool IsAddressOverridden`,
  `DateTime? AddressChangedAt`, and `OrderDeliveryAddressDto? OrderDeliveryAddress`
  — the order's *current* choice, so the banner can name the difference rather
  than just assert one exists.
- New endpoint: `POST outgoing-shipments/{id:guid}/acknowledge-address-changes`,
  permissions following the `outgoingShipments` module, returning 204.
- `CreateOutgoingShipmentEndpoint` and `UpdateOutgoingShipmentEndpoint` set
  `IsAddressOverridden` on each order stop by comparing the requested
  `(SelectedAddressKind, ClientDeliveryPlaceId)` against the order's own. They
  also clear `AddressChangedAt` on every stop of the shipment.

## Frontend

### Order editor — `OrderEditor.tsx`

An "Adresa doručení" field in the client card, directly below the client
picker (`OrderEditor.tsx:653-675`):

```
Fakturační
Kontaktní                 ← omitted when the client has no contact address
── Vlastní místa ──
Letní zahrádka
Sklad Liberec
───────────────────
+ Nové místo…
```

- The resolved address renders as a caption line beneath the control; for a
  place with no street parts that is its coordinates, via the existing
  `formatPlaceAddress`.
- Disabled until a client is selected, with the same "vyberte klienta" framing
  the product catalog already uses.
- Changing the client resets the choice to `Official` and clears the place —
  the old place belongs to the old client and the backend would reject it.
- `+ Nové místo…` opens `DeliveryPlaceDialog`, POSTs immediately (same
  deliberate behaviour as the shipment editor: the place is saved on the client
  even if the order draft is abandoned), invalidates
  `qk.clientDeliveryPlaces(clientId)`, and selects the new place.
- A stop-editor behaviour that carries over: an order pointing at a
  soft-deleted place keeps a selected, disabled option labelled with the place
  name. Without it the value matches no option and re-saving silently relocates
  the delivery to the billing address.
- Both fields join `serializeForm` (`OrderEditor.tsx:67`) so the
  unsaved-changes guard sees a changed address.

Data comes from hooks that already exist: `useClient(clientId)` for the
official and contact addresses, `useClientDeliveryPlaces(clientId)` for the
places.

### Order detail — `OrderDetail.tsx`

A delivery-address line in the header block, under the client name
(`OrderDetail.tsx:125-132`), rendered unconditionally — `Official` is a real
answer, not an absence:

- the formatted address, from `OrderDto.deliveryAddress.address`;
- for a saved place, the place name as a chip beside it and the driver note as
  a caption below.

### Shared code moves

`DeliveryPlaceDialog` and `AddressMapPicker` already live in
`components/common/` and are reusable as they stand. Only the pure choice
encoding has to move:

- `encodeStopChoice` / `decodeStopChoice` / `NEW_PLACE_CHOICE` and the
  `resolveFromAddresses` core move from `shipments/stopAddress.ts` to a new
  `clients/deliveryAddress.ts`, alongside `deliveryPlaceFormat.ts`.
  `stopAddress.ts` keeps only the two stop-specific resolvers
  (`resolveStopAddress`, `resolveDetailStopAddress`) and imports the rest.
  `stopAddress.test.ts` splits along the same line.
- A new pure `resolveOrderDeliveryAddress(client, places, kind, placeId)` in
  `clients/deliveryAddress.ts` backs the editor's preview line.

### Shipment editor and detail

Both gain a banner above the stop list, listing the stops whose
`addressChangedAt` is set, with two messages driven by `isAddressOverridden`:

- `false` → *"Adresa doručení byla aktualizována podle objednávky."*
- `true` → *"Objednávka má jinou adresu doručení než tato zastávka."*

A "Rozumím" action calls the acknowledge endpoint and invalidates the shipment
detail. In the editor, saving the shipment clears the stamps anyway; the button
is there so the read-only detail can dismiss it too.

`ShipmentEditor.tsx:355` stops hardcoding `Official` and pre-fills from the
order's `deliveryAddressKind` / `clientDeliveryPlaceId`.

### Codegen

The backend DTO changes, the enum rename and their frontend consumption land in
the same commit; `yarn generate-api` runs against a locally running backend.

## Testing

**Backend**

- Order validators: kind ↔ FK pairing in both directions; `Contact` with no
  contact address.
- Order endpoints: cross-client place rejected; a soft-deleted place rejected
  on new assignment; an order already pointing at a soft-deleted place still
  saves; the detail projection still resolves a soft-deleted place.
- Propagation, one test per branch: inherited stop follows and is stamped;
  overridden stop keeps its address and is stamped; a stop on a `Delivered`
  shipment is untouched; an order edit that does not change the address stamps
  nothing; changing the client propagates.
- Shipment write: `IsAddressOverridden` derived true when the stop differs from
  the order, false when the planner picks the order's own value back;
  `AddressChangedAt` cleared on update.
- The acknowledge endpoint clears every stop of its shipment and nothing else.

**Frontend**

- Pure: the moved encode/decode round-trip (including a place whose id is the
  literal `Official`), and `resolveOrderDeliveryAddress` across all three kinds
  plus the missing-place fallback.
- Component: the order editor's picker lists the client's places; `+ Nové
  místo…` opens the dialog; changing the client resets the choice; a
  soft-deleted place stays selectable on an order that already uses it; the
  field is disabled with no client.
- Component: `OrderDetail` renders each of the three kinds, including a place
  with coordinates only and its driver note.
- Component: the shipment banner shows the right message per
  `isAddressOverridden`, and disappears after acknowledging.

## Out of scope

- Reverse geocoding a map-clicked point into address fields (already out of
  scope in the delivery-places spec).
- Incoming deliveries (Dovozy) — they have custom stops.
- Any change to how the official address is used for invoicing.
- Per-order one-off addresses that are not saved on the client. A place is
  always saved; that is the whole point of the delivery-places feature.
