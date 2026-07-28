# Historical seed data for the Reporty module

**Date:** 2026-07-28
**Status:** approved

## Problem

The Reporty module renders three tabs (Objemy, Klienti, Provoz) and all three are
empty on the dev database. This is a data gap, not a bug.

Every volume figure in the module flows through one query,
`DeliveredLineQuery.Project` (`Features/Reports/Utils/DeliveredLineRow.cs`), which
requires an unbroken chain:

```
OrderItem → Order → OutgoingShipmentStop (Kind = Order)
                  → OutgoingShipment (State = Delivered, DeliveryDate within window)
```

Dev satisfies none of it. At the time of writing it holds 2 outgoing shipments,
both `Created`, and 7 orders, none with an `ActualDeliveryDate`. So:

- **Objemy / Klienti** — zero delivered lines, both tabs blank.
- **Provoz** — on-time % needs orders that are `Finished` and carry *both*
  `RequiredDeliveryDate` and `ActualDeliveryDate` (`GetOperationsEndpoint`); there
  are none. The driver chart counts drivers on delivered shipments; there are none.

The module offers 30 / 90 / 180-day windows (`ReportPeriod` in `reportModel.ts`),
so anything shallower than ~180 days leaves the widest view sparse.

## Goal

Generate enough plausible history that all three tabs render meaningfully, without
disturbing the hand-built live-state fixtures dev already has.

Explicitly **not** a goal: realistic business figures. Volumes, punctuality and
client ranking are invented to look plausible. They are fine for exercising the UI
and must not be read as anything else.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Existing operational data | Add alongside, do not replace | The 2 `Created` shipments and 7 open orders are the fixtures used to test Vývozy / Nakládka / Fakturace. History is a separate, closed-out block dated in the past. |
| Span | 2026-01-01 → 2026-07-27 (~30 weeks) | Fills the widest (180-day) window with room to spare. |
| Density | ~5 delivery runs/week | ~150 shipments. Enough for weekly buckets, client ranking and driver comparison; not enough to slow the reports down. |
| Placement | New `HistoryBuilder`, not `OperationalDataBuilder` | The latter builds *current* state (one Created shipment, one InTransit, open orders) under different rules. Mixing generated history in would blur both. |
| Determinism | `Random` with a fixed seed constant | Same range always yields the same data, so it is assertable in tests and reproducible across environments. |

## Design

### `AleTrack.Seeding/Builders/HistoryBuilder.cs`

One public entry point:

```csharp
public static HistoryBundle CreateHistory(
    IReadOnlyList<Client> clients,
    IReadOnlyList<Product> products,
    IReadOnlyList<Vehicle> vehicles,
    IReadOnlyList<Driver> drivers,
    IReadOnlyList<Brewery> breweries,
    DateOnly from,
    DateOnly to)
```

`HistoryBundle` carries `Orders`, `Shipments` and `Deliveries`. The builder is pure
— it takes already-materialised entities and returns new ones, touching no
`DbContext`, which is what makes it unit-testable.

For each week in range it emits ~5 runs on weekdays:

| Element | Shape | Report surface it feeds |
|---|---|---|
| Shipment | `Delivered`, `DeliveryDate` set (UTC), 1–2 drivers, one vehicle | Volume trend, driver chart, active drivers |
| ~6% of runs | `Cancelled`, `DeliveryDate` still set | State donut — `GetOperationsEndpoint` counts any state with a delivery date, so a single-slice donut would otherwise be the only outcome |
| Stops | 2–4 stops, all `OutgoingShipmentStopKind.Order` | Total stops |
| Orders | `Finished`, both `RequiredDeliveryDate` and `ActualDeliveryDate` | On-time % |
| ~12% of orders | actual > required | Lands on-time near 88% instead of an implausible 100% |
| Order items | 2–5 lines drawn across all three breweries and all product kinds | Volume by brewery and kind, client ranking |
| ~35% of orders | 1–2 `OrderReturn` rows (empty kegs) | Returnable units |
| Incoming | ~2 `ProductDelivery`/week, `Finished`, dated in range | Incoming-vs-outgoing chart |

Orders on a cancelled run are themselves `Cancelled`. They are naturally excluded
from volume — `DeliveredLineQuery` filters on shipment state — but they must not be
left `Finished`, or the on-time ratio would count deliveries that never happened.

Two deliberate distortions, so the charts have shape rather than noise:

- **Client weighting** — a few large accounts and a long tail, so the Klienti
  ranking is ordered rather than uniform.
- **Seasonality** — a per-month multiplier, roughly 1.4× May–July against 0.8× in
  winter, so the Objemy trend line actually trends.

Expected output: ~150 shipments, ~450 order stops, ~450 orders, ~1,600 order lines,
~160 returns, ~225 shipment-driver links, ~60 incoming deliveries with ~90 stops
and ~180 items — roughly 3,400 rows in total.

### Wiring

- `SeedingService.InsertDataAsync()` — appends history, so a fresh seed gets it.
- `SeedingService.InsertHistoryAsync()` — new top-up path. Loads existing clients,
  products, drivers, vehicles and breweries from the database and adds only
  history, leaving current-state fixtures untouched.
- `Program.cs` — dispatches on `args[0] == "history"`.

### Prerequisite: the seeder cannot currently be pointed at another database

`Program.cs` builds config with `Host.CreateDefaultBuilder(args)` and then calls
`AddJsonFile`. Those JSON sources land *after* the env-var source the default
builder installs, so they win, and `ConnectionStrings__AleTrack` is silently
ignored — the trap the root `CLAUDE.md` documents as "the seeder reads appsettings,
not env vars".

Appending `.AddEnvironmentVariables()` after the JSON files fixes it and brings the
seeder in line with the API, which already honours env-var overrides. Without this
there is no way to run the top-up against dev short of editing a config file.

## Testing

`HistoryBuilder` is pure, so it tests without a database:

- A fixed seed produces stable counts (guards accidental generator changes).
- Every `Delivered` shipment has a non-null `DeliveryDate`.
- Every `Finished` order has both `RequiredDeliveryDate` and `ActualDeliveryDate`.
- Orders on cancelled runs are `Cancelled`, never `Finished`.
- The on-time ratio falls in an expected band.
- No order is attached to more than one stop.
- All generated dates fall inside the requested window.

## Risks

- Writes ~3,400 rows to the dev database. Additive only; no existing row is
  updated or deleted.
- The generated figures are invented. They exercise the UI and nothing more.
