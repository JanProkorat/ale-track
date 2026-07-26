# Client delivery places (Místa doručení)

**Date:** 2026-07-25
**Scope:** Full-stack. A new client-owned collection of named delivery
locations, offered as a third option when picking where an outgoing-shipment
stop delivers, alongside the existing fakturační / kontaktní addresses.
**Prototype:** `docs/prototype/aletrack-prototype.html` — `#/clients/cl-uzsklep`
(management), `#/shipments/s-1/edit` (picker), `#/shipments/s-1` (read).

## Goal

When editing an outgoing shipment, a client stop can currently deliver to one of
two places: the client's official (billing) address or its contact address. Both
come from the `clients` row. Real deliveries do not always go to either — a
summer garden across the river, a supply yard, a barn by the road with no postal
address at all.

The operator needs a third option: a place they define themselves, picked from a
map or an address search, the same way a custom stop is defined today.

## Decisions taken during design

Each of these was an open question; recording the choice and its cost.

**Places are saved on the client, not on the stop.** A one-off place stored on
`outgoing_shipment_stops` would have been the smallest change — the columns
(`label`, `note`, `latitude`, `longitude`) already exist there for custom stops.
It was rejected because the same alternative destination recurs across
shipments, and re-picking it on a map every time is the actual complaint. Cost:
a new table, a management surface, and a deletion policy.

**A place carries a full structured address, not just coordinates.** It reuses
the owned `Address` type, so every existing read path renders it exactly like the
official and contact addresses with no new formatting code, and it stays usable
on a printed delivery note. Cost: `searchAddresses` must request
`addressdetails=1` from Nominatim and map the parts into fields.

**The address parts are optional; the coordinates are not.** A place always comes
from a map pick or a geocoded hit, so it is always plottable — but a barn by the
road has no street. Text fields are nullable, `latitude`/`longitude` are `NOT
NULL`. This deviates from `Address`'s own attributes and is applied per-property
in the configuration; the shared type is not modified.

**Places are authored both inline and in the client detail.** The stop picker
offers `+ Nové místo…`, which saves the place onto the client immediately —
before the shipment is saved, and even if the shipment draft is then abandoned.
The alternative, deferring the write to shipment save, means the draft carries an
unsaved entity and the dirty-check becomes materially harder. The immediate write
is deliberate.

**Deletion is soft.** The place leaves every picker but keeps resolving on
shipments that already reference it. Hard delete would either destroy history or
make a used place undeletable.

**The stop's identity does not change.** A stop delivering to a place still
renders as that client's stop — same coloured round pin, client name as the
title. Only the address line changes, plus a chip naming the place.

## Data model

### New: `ClientDeliveryPlace`

`Entities/ClientDeliveryPlace.cs`, `PublicSoftlyDeletableEntity`, table
`client_delivery_places`. Shaped like `ClientNote`.

```
id, public_id, is_deleted              -- base
client_id       bigint       NOT NULL  FK → clients(id) ON DELETE CASCADE
name            varchar(100) NOT NULL
note            varchar(200) NULL         -- instruction for the driver
street_name     varchar(50)  NULL   ┐
street_number   varchar(50)  NULL   │ owned Address, inlined, unprefixed
city            varchar(50)  NULL   │ (only one address on the row, so
zip             varchar(10)  NULL   │  OwnsAddressWithPrefix is not needed)
country         integer      NOT NULL │
latitude        numeric      NOT NULL │
longitude       numeric      NOT NULL ┘
```

`ClientDeliveryPlaceConfiguration`:

- `builder.OwnsOne(x => x.Address, a => a.WithOwner());`
- `.IsRequired(false)` on `StreetName`, `StreetNumber`, `City`, `Zip`
- `.IsRequired()` on `Latitude`, `Longitude`
- `Country` defaults to `Country.Czechia`. The enum starts at 1, so
  `default(Country)` is `0` — not a valid value. The create/update DTO therefore
  declares it `Country?` and the handler substitutes `Czechia` when it is null,
  rather than letting an unset field validate as an out-of-range enum.
- **No global query filter.** `ClientNoteConfiguration` sets one; doing the same
  here would silently null out the `Include` when the shipment detail loads a
  shipment pointing at a since-removed place — the address would vanish from
  history with no error. Non-deleted filtering happens explicitly in the list
  endpoint instead.

### Changed: `OutgoingShipmentStop`

One added column, `client_delivery_place_id bigint NULL`, FK →
`client_delivery_places(id)` `ON DELETE RESTRICT`.

`OutgoingShipmentStopAddressKind` gains `DeliveryPlace = 2`.

The stop's own `label` / `note` / `latitude` / `longitude` stay
custom-stop-only and are untouched by this feature.

### Migration

Two columns and one table; no data movement. Existing stops keep
`selected_address_kind` 0/1 with a null FK.

## API

New feature folder `Features/ClientDeliveryPlaces/`, following the `Notes` route
convention (collection under the parent, item at the root).

| Operation | Route |
|---|---|
| List | `GET clients/{id:guid}/delivery-places` |
| Create | `POST clients/{id}/delivery-places` |
| Update | `PUT clients/delivery-places/{Id:guid}` |
| Delete (soft) | `DELETE clients/delivery-places/{Id:guid}` |

The list returns non-deleted places only. Permissions follow the `clients`
module, matching notes and reminders.

Two existing DTOs grow a field so the shipment editor needs no extra round trip:

- `OutgoingShipmentOrderDto` (the unassigned-orders list the editor already
  loads) gains `List<ClientDeliveryPlaceDto> ClientDeliveryPlaces` — non-deleted
  only. This fills the picker.
- The stop in `OutgoingShipmentDetailDto` gains the resolved place (name, note,
  `AddressDto`), loaded **without** the `!IsDeleted` condition.

## Validation

In `ClientOrderShipmentDtoValidator`, since the enum and the FK can disagree:

- `SelectedAddressKind == DeliveryPlace` → `ClientDeliveryPlaceId` required.
- Any other kind → `ClientDeliveryPlaceId` must be null.
- `SelectedAddressKind == Contact` → the client must have a contact address.
  This check does not exist today; the frontend merely hides the option.

In the create/update endpoints (DB lookups, not validator rules):

- The referenced place must belong to the stop's own client. Cross-client
  references are the one way this schema can go wrong.
- A soft-deleted place is rejected on write. It still resolves on read.

## Frontend

### Shipment editor — `ShipmentEditor.tsx`

`DraftStop` gains `deliveryPlaceId?: string`.

The `Select` value becomes a string key, mapped back to `{addressKind,
deliveryPlaceId}` on change, because a bare enum number no longer identifies the
choice. The encoding validated in the prototype is `'Official'` / `'Contact'` /
`'place:<PublicId>'` / `'__new'` — the `place:` prefix keeps IDs from colliding
with the two literals. The control widens from 140px; place names do not fit.

```
Fakturační
Kontaktní
── Vlastní místa ──
Letní zahrádka
Sklad Liberec
───────────────────
+ Nové místo…
```

Two behaviours the picker must have:

- **`+ Nové místo…`** opens `DeliveryPlaceDialog`, POSTs on confirm, invalidates
  the unassigned-orders query, and selects the new place on that stop.
- **A stop pointing at a soft-deleted place** keeps a selected, disabled entry
  labelled with the place name. Without it, the value matches no option and
  re-saving silently relocates the delivery to the billing address.

Address resolution moves out of the component into a sibling `stopAddress.ts`
(the `shipmentInvoiceModel.ts` pattern) so it is unit-testable without a
rendering harness. Both the editor and the detail read it.

### The dialog

`CustomStopDialog` returns `{label, note, lat, lng}` with no address parts and is
also used by Dovozy, so it is not overloaded. Its autocomplete + map + point
state is extracted into a shared `AddressMapPicker`, leaving two thin dialogs
over it: the existing custom-stop one and a new `DeliveryPlaceDialog` that adds
the four editable address fields.

`searchAddresses` gains `addressdetails=1` and returns Nominatim's parsed parts
alongside `label` / `lat` / `lng`; existing callers ignore the new field. Parts
map as `road` → street, `house_number` → number, `city|town|village` → city,
`postcode` → zip, `country_code` cz → Czechia, de → Germany, anything else →
Czechia. They prefill the form **editable**, because CZ rural addresses parse
unevenly.

### Client detail — `ClientDetail.tsx`

A `Místa doručení` card, `DeliveryPlacesPanel.tsx`, built like `NotesPanel` /
`RemindersPanel`: name + formatted address + driver note, add / edit / delete,
delete behind `ConfirmDialog`, all gated on `canEdit('clients')`. A place with no
street shows its coordinates in place of the address line.

### Shipment detail — `ShipmentDetail.tsx`

The stop keeps the client's coloured pin and name. The place name appears as a
chip beside the title; the address line below shows the place's formatted
address, or its coordinates when it has none. Route map and driver view consume
the resolved coordinates with no other change.

### Codegen

Backend DTO changes and their frontend consumption land in the same commit;
`yarn generate-api` runs against a locally running backend.

## Testing

**Backend**

- Validator: kind ↔ FK pairing in both directions; `Contact` without a contact
  address.
- Endpoints: cross-client place reference rejected; write against a soft-deleted
  place rejected; detail read still resolves a soft-deleted place; the four CRUD
  operations.

**Frontend**

- Pure unit tests for the extracted address resolver and the Nominatim parts
  mapper.
- Component tests for: the picker listing a client's places, `+ Nové místo…`
  opening the dialog, and a soft-deleted place staying selectable on a stop that
  already uses it.

## Out of scope

- Reverse geocoding a map-clicked point into address fields.
- Places on incoming deliveries (Dovozy) — those already have custom stops.
- Any change to how the official address is used for invoicing.
