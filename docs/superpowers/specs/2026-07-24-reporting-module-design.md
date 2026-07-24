# Reporting module (Reporty)

**Date:** 2026-07-24
**Scope:** Full-stack. New read-only analytics module — backend aggregation
endpoints under `Features/Reports/Queries/` + a new frontend `reports` module.
**Prototype:** `docs/prototype/aletrack-prototype.html#/reports` (approved).

## Goal

Give the operator a single place to answer "how much did we deliver, to whom,
and how is the operation running" over a chosen time window. The seed question
was *how many products were delivered in outgoing shipments over time, in total
and per brewery, and which clients take the most* — this module answers that and
a bit more, without inventing data the model can't back.

## Scope decisions (settled during brainstorming)

- **v1 = three themes: Volume, Clients, Operational.** All run on quantities and
  dates that already exist in the schema.
- **Revenue / financial is explicitly deferred to a phase 2.** It is only
  meaningful once each client has a negotiated per-product price; today the only
  price is the brewery product's default. Client-specific pricing is its own
  prerequisite subsystem (new entity + CRUD + UI) and gets its own spec →
  plan → build cycle. This module ships no money figures and no currency toggle.
- **"Delivered" = actuals, not plans.** A product counts as delivered only when
  its outgoing shipment reached the `Delivered` state, dated by the shipment's
  `DeliveryDate`. (Not "any non-cancelled shipment", not `Order.ActualDeliveryDate`.)
- **Volume is expressed three ways:** unit counts **split by `ProductKind`**
  (kegs / bottles / cans / multipacks), **total weight in kg** via the backend's
  computed `Product.Weight`, and a breakdown **by `ProductType`**. No single blunt
  mixed-unit total.
- **Layout = one page, tabbed.** Shared control row (tab switcher + period filter
  on one line), then the active tab's KPIs + charts. Not a long scroll, not
  separate routes.
- **Period filter presets:** last 30 days / 90 days / 6 months. Default 90.

## Key definitions

### The "delivered volume" query path

```
OutgoingShipment (State == Delivered, DeliveryDate in [from, to])
  └─ Stops where Kind == Order
       └─ ClientOrder (the linked Order)
            └─ OrderItems → Product (Kind, Type, BreweryId, Weight)
```

- Bucketed / grouped by `OutgoingShipment.DeliveryDate`.
- **Client/custom extra items are out of scope for v1 volume.**
  `OutgoingShipmentCustomExtraItem` is free-text (no product/brewery/type), and
  `OutgoingShipmentClientExtraItem` points at an `InventoryItem` whose product
  link is optional — neither maps cleanly onto the brewery/type/kind breakdowns.
  v1 counts **order-line products** only. This is a documented limitation, not an
  oversight; revisit if the operator reports material undercounting.
- **Weight** uses the entity's computed `Product.Weight` (kg, derived from
  `Kind` + `PackageSize`). The prototype approximated weight per kind; the real
  implementation uses the actual computed property. Volume kg = Σ (`Quantity` ×
  `Product.Weight`).

### On-time delivery

% of `Finished` orders whose `ActualDeliveryDate <= RequiredDeliveryDate`
(orders with a null `RequiredDeliveryDate` are excluded from the ratio).

## Backend design

All new code under `AleTrack/Features/Reports/Queries/`, FastEndpoints style
(`EndpointWithoutRequest<TDto>` or a small request DTO for the date range,
`RequireAuthenticated()`), injecting `AleTrackDbContext`. One endpoint per tab so
each loads independently and its DTO stays focused:

### 1. `GET reports/delivery-volume?from={date}&to={date}&granularity={day|week|month}`

`DeliveryVolumeReportDto`:
- `totalWeightKg` (decimal), `totalUnits` (int)
- `unitsByKind`: `[{ kind, units, weightKg }]`
- `byBrewery`: `[{ breweryId, breweryName, color, weightKg, units }]`
- `byType`: `[{ type, weightKg, units }]`
- `series`: `[{ bucketStart (DateOnly), weightKg, units }]`

**Bucketing approach:** aggregate by day in SQL (`GroupBy` on
`DeliveryDate.Date` + Kind/Brewery/Type as needed), materialize, then roll daily
rows up to week/month in the handler (C#). Avoids DB-specific week truncation and
the dataset is small. Document this in the handler.

### 2. `GET reports/client-volume?from={date}&to={date}`

`ClientVolumeReportDto`:
- `clientsServed` (int), `totalDeliveries` (int — distinct shipment-stop count),
  `totalWeightKg`
- `topClients` (all clients with volume, FE slices top 10):
  `[{ clientId, clientName, region, deliveries, units, weightKg }]`
- `byRegion`: `[{ region, weightKg, units }]`

### 3. `GET reports/operations?from={date}&to={date}`

`OperationsReportDto`:
- `shipmentsByState`: `[{ state, count }]` (outgoing shipments in window by
  `DeliveryDate`)
- `onTimePercentage` (decimal, see definition above)
- `returnableUnits` (int — Σ `OutgoingShipmentReturn.Quantity` on delivered
  shipments)
- `incomingVsOutgoing`: `[{ month, incomingWeightKg, outgoingWeightKg }]`
  (incoming = `ProductDelivery` → `DeliveryStop` → `DeliveryItems` weight;
  outgoing = delivered order-item weight)
- `byDriver`: `[{ driverId, driverName, color, deliveredShipments }]`

All three take the same `from`/`to`; the frontend computes them from the period
preset and passes explicit dates (endpoints stay stateless).

## Frontend design

New `reports` module wired into the existing conventions:

1. **Register the module** — add `'reports'` to `MODULE_KEYS`
   (`app/src/auth/permissions.ts`); this flows into the `ModuleKey` union, `PATHS`
   (`app/src/routes/paths.ts`), and the permission matrix automatically.
2. **Nav** — new group **Analýza** in `app/src/layout/nav-config.tsx` with a
   `reports` item (chart icon), placed after the Sklad group (mirrors the
   prototype).
3. **Route** — single page in `app/src/routes/router.tsx`:
   `{ path: PATHS.reports, element: <ReportsPage /> }`. No detail/editor routes.
4. **Page** — `app/src/features/reports/ReportsPage.tsx`. Control row =
   `SegControl` tab switcher (Objem / Klienti / Provoz) + `SegControl` period
   preset on one line. Only the active tab's data is fetched (lazy per tab).
   Sub-components: `VolumeTab.tsx`, `ClientsTab.tsx`, `OperationalTab.tsx`.
5. **Hooks** — extend `app/src/hooks/useReports.ts` with `useDeliveryVolume`,
   `useClientVolume`, `useOperationsReport`, each a `useQuery` keyed on
   `qk.reports.*(params)` (add report keys to `app/src/api/queryKeys.ts`), calling
   the regenerated client methods. Wrap tab bodies in `QueryBoundary`.
6. **KPIs** reuse `StatCard`; tables reuse `DataTable<T>`; status chips reuse
   `StatusPill`. Clients table rows navigate to the client detail.

### Charting library

**None is installed today.** Add **`@mui/x-charts`** — same vendor as the
already-present `@mui/x-date-pickers`, so it inherits the MUI theme (light/dark
`cssVars`) with no extra styling layer. Used for the line/area trend, bar
breakdowns, pie/donut by-type, and the on-time gauge. (Alternative considered:
recharts — rejected to avoid a second theming system.)

## The frontend ↔ backend contract

Per the root `CLAUDE.md`: the API client is generated from the backend Swagger
doc. **The new endpoints/DTOs and their frontend consumption ship in the same
commit** — start the backend locally, run `cd app && yarn generate-api`, then
build the hooks against the regenerated client. A DTO shape change without regen
silently breaks the frontend.

## Permissions

`reports` becomes a module key with `none|view|edit` in the client-side matrix;
the page/nav gate on `canSee('reports')`. Backend endpoints are
`RequireAuthenticated()` only — consistent with the current state where granular
per-module authorization is not yet wired to the backend (Admin/User roles only).
Reports are read-only, so `edit` is meaningless here; `view` gates visibility.

## Non-goals (future phases)

- **Revenue / financial reporting** — needs the client-specific pricing subsystem
  first (separate spec). Then a fourth tab (Tržby) reusing this module's filter
  and chart infrastructure.
- Export (CSV / PDF), scheduled/emailed reports, custom date ranges beyond the
  three presets, drill-through from a chart segment to the underlying records.
- Extra-item (custom / client) volume inclusion — see the delivered-volume note.

## Testing

- **Backend** (xUnit + FluentAssertions + Moq.EntityFrameworkCore, no DB): unit
  tests per endpoint over a mocked `DbContext` seeded with a small fixture —
  assert delivered-only filtering (a non-`Delivered` shipment is excluded),
  correct weight aggregation (`Quantity × Product.Weight`), kind/brewery/type
  grouping, day→week→month bucketing, on-time ratio with a null-required-date row
  excluded, and empty-window → zeroed DTO.
- **Frontend**: component tests for each tab rendering from mocked hook data,
  including the empty state via `QueryBoundary`; a test that switching the period
  preset refetches with the right date params.

## Open questions

None blocking. The extra-item exclusion and the on-time definition are the two
judgement calls; both are documented above and can be revisited from real usage.
