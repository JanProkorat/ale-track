# Address search in the custom-stop map picker

**Date:** 2026-07-23
**Scope:** Frontend-only. Outgoing shipments (Vývozy) custom-stop picker.

## Problem

When adding a custom (non-brewery) stop to an outgoing-shipment route, the user
can only set the location by clicking on the map (`CustomStopDialog.tsx`). There
is no way to locate a spot by street address. This spec adds an address search to
that dialog so the user can type an address, pick from matches, and have the pin
placed automatically — while keeping the existing click-on-map method working.

## Scope decisions (settled during brainstorming)

- **Vývozy only.** Deliveries (Dovozy) have no custom-stop infrastructure at any
  layer (no entity fields, DTOs, endpoint mapping, or UI). Bringing custom stops
  to Dovozy is a separate full-stack feature and is explicitly **out of scope**
  here; it will get its own spec later.
- **UX = search box + results list.** Explicit submit (Enter / button), not
  per-keystroke autocomplete. This is simpler and respects Nominatim's usage
  policy (max ~1 request/second) — the same public endpoint the app already uses.
- No backend, DTO, or `ShipmentEditor` changes. The `onAdd` contract is unchanged.

## Design

### 1. Geocoder helper — `app/src/lib/geo.ts`

The existing `geocodeAddress(a, signal)` returns a single best match (`limit=1`)
and is used by the brewery/client form drawers on save. Leave it untouched. Add a
sibling that returns multiple labeled candidates for interactive selection:

```ts
export interface AddressHit {
  label: string; // Nominatim display_name
  lat: number;
  lng: number;
}

export async function searchAddresses(
  query: string,
  signal?: AbortSignal,
): Promise<AddressHit[]>;
```

Behavior:
- Hits `https://nominatim.openstreetmap.org/search` with
  `q=<query>`, `format=jsonv2`, `limit=5`, header `Accept: application/json` —
  mirroring the base URL / headers / try-catch style already in the file.
- Maps each hit: `display_name` → `label`, `lat`/`lon` → numeric coords.
- Drops entries whose coords are not finite.
- Returns `[]` on empty query, no match, non-OK response, or thrown error
  (callers treat an empty list as "nothing found").

### 2. `CustomStopDialog.tsx`

Add a search row **above** the existing map. The map, the coords readout, the
`Název zastávky` (required) / `Poznámka` fields, and the `onAdd({ label, note,
lat, lng })` contract are all preserved.

- **Search input:** a `TextField` ("Najít podle adresy…") plus a search button.
  Pressing **Enter** in the field or clicking the button runs the search.
- **Loading:** show a spinner while the request is in flight; disable the submit
  affordance so a second search can't stack on the first.
- **Results:** render up to 5 hits as a compact, scrollable MUI
  `List` of `ListItemButton`s beneath the input. Selecting a result:
  - sets `point` (dropping the existing diamond pin),
  - **recenters** the map to the picked coordinates at ~zoom 15,
  - prefills the required `Název zastávky` field with the result label **only if
    that field is still empty** (never overwrites what the user typed),
  - clears the results list.
- **No match / error:** inline helper text *"Adresu se nepodařilo najít"*
  (consistent with the drawers' existing Czech copy). No snackbar.
- **Map recentering:** a small `Recenter` child component using react-leaflet's
  `useMap()` calls `map.setView([lat, lng], 15)` when a *searched* point is
  chosen. It must NOT fire on manual map clicks, so the view isn't yanked while
  the user is clicking around the map directly.
- **Coexistence:** clicking the map still sets the point exactly as today. The
  two input methods are independent; the last action (click or pick) wins.
- **Cancellation:** an `AbortController` cancels any in-flight search when a new
  search starts and when the dialog closes / resets (extend the existing `reset`).

### 3. Data flow

```
user types address ──▶ searchAddresses(query) ──▶ AddressHit[]
                                                      │
                          click a result ────────────┤
                                                      ▼
              setPoint(lat,lng) ─▶ Marker + Recenter(setView) ─▶ prefill label if empty
                                                      │
                                       confirm() ─▶ onAdd({label, note, lat, lng})  (unchanged)
```

### 4. Error handling

- Network / HTTP / parse failures inside `searchAddresses` resolve to `[]`; the
  dialog shows the "not found" helper text rather than throwing.
- Aborted requests (superseded search or dialog close) are swallowed — no error
  surface.
- Existing confirm-time validations are unchanged: `point` required
  ("Klikněte do mapy…") and non-empty `label` ("Zadejte název zastávky.").

## Testing / verification

- **Unit test** — `app/src/lib/geo.test.ts` for `searchAddresses`, mocking
  `fetch`:
  - multiple hits → mapped to `AddressHit[]` with correct label/lat/lng,
  - empty array response → `[]`,
  - non-OK response → `[]`,
  - thrown / rejected fetch → `[]`.
  This is the repo's first frontend test, but vitest (happy-dom) is already
  configured (`vitest.config.ts`, `src/test/setup.ts`).
- **Typecheck / build** — `yarn build` (runs `tsc`).
- **Manual** — run the app, open a shipment editor, add a custom stop:
  1. type an address, submit, pick a result → pin drops, map recenters, label
     prefills when empty;
  2. verify clicking the map directly still sets the point;
  3. verify a nonsense query shows the "not found" text.

## Out of scope

- Custom stops / via-points on deliveries (Dovozy) — separate full-stack feature.
- Reverse geocoding (coords → address) for the coords readout.
- Autocomplete-as-you-type.
- Any backend, DTO, or API-contract change.
