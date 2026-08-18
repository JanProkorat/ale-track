# Dodavatelé — a registry of non-beer suppliers

**Date:** 2026-08-17
**Status:** Design approved (prototype), ready for implementation
**Branch:** `feature/suppliers`
**Prototype:** `docs/prototype/aletrack-prototype.html` — module built and clickable at `#/suppliers`

## Problem

Beer reaches a client through Pivovary → Objednávky → Vývozy, and everything in
that chain hangs off `Product`, whose `BreweryId` is **not nullable**
(`Entities/Product.cs:20`). But we ship more than beer: CO₂ and Biogon bottles
ride along on a vývoz, and crates, kegs, sanitation chemicals and merch have to
be bought somewhere. None of those suppliers exist anywhere in the system.

Today that knowledge lives in people's heads and phone contacts: which plnírna
refills a 30 kg CO₂ bottle, what it costs, whether the deposit is refundable,
and — the question that actually decides a driver's route — **whether they are
open right now**. A dispatcher sending a van to a plnírna that shuts for lunch
at 11:30 loses an hour.

This module adds that record: a supplier with both addresses, contacts, weekly
opening hours and its own price list. It is a **registry only** — see Scope.

## Scope

**In:** the `Supplier` entity and its CRUD, contacts, weekly opening hours,
a price list of goods priced per charge kind, notes, list/detail screens,
permissions, nav, sidebar count.

**Out, deliberately:**

- **Buying against a supplier.** Nothing touches Objednávky, Vývozy, Sklad or
  Dovozy; `Product.BreweryId` stays non-nullable and `DeliveryStop.BreweryId`
  keeps its meaning. Recording a purchase or a refill is the next slice, and it
  needs its own decision about whether supplier goods become stockable items.
- **Reminders.** The prototype has a Připomínky tab, and `Reminder` is a rich
  entity (recurrence types, weekly/monthly day sets, `ActiveUntil`) whose
  per-host endpoints are duplicated by hand (`Features/Reminders/**`) and whose
  results are aggregated by `GetUpcomingRemindersEndpoint` and rendered by
  `RemindersDrawer`. Adding a fourth host is a self-contained follow-up; doing
  it here would roughly double the change for a tab nobody has asked to use
  yet. **The tab is not rendered** — it is not a stub, it is absent.

## Decisions

| Question | Decision |
|---|---|
| Own entity or reuse `Brewery` | Own entity. A brewery's identity is its beer catalogue and its display colour/order in the ceník tab strip; a supplier has neither and has opening hours instead |
| Type/category field | **None.** Asked and rejected by the user — nothing filters or groups by it |
| Soft delete | Yes (`PublicSoftlyDeletableEntity`), like `Client`. Purchase history will reference suppliers, so an id must stay resolvable |
| Price-list shape | Two tables: a good has identity, prices hang off it — one row per charge kind |
| Charge kinds | `Fill` / `Purchase` / `Deposit` / `Rent` / `Other` → Plnění / Nákup / Záloha / Nájem / Ostatní |
| Opening hours | Weekly recurring, **several intervals per day**; a day with no interval is closed |
| Nonstop | `From = 00:00`, `To = 23:59` (see *The 24:00 problem*) |
| Who computes open/closed | **The frontend**, from the browser clock, in a pure tested module |
| List payload | One rich list call, not a list + N detail calls (see *Deviation from the clients list*) |
| Grouping in the list | None — flat, alphabetical with Czech collation |
| Permission module | New `ModuleType.Suppliers`, **appended last** to the enum |

### The 24:00 problem

The prototype stores a nonstop point as `00:00–24:00` so that a plain string
compare (`from <= t < to`) is true all day. `TimeOnly` cannot hold 24:00 — its
maximum is 23:59:59.9999999 — and neither can `<input type="time">`.

So the persisted form is `00:00–23:59`, and "nonstop" is a **rendering** of that
pair, not a stored flag. The prototype's normalisation therefore inverts: it
canonicalised 23:59 → 24:00 on save, the real model keeps 23:59 and formats it.
The cost is a one-minute hole at 23:59 in `isOpenNow`, which no dispatcher will
ever observe; the alternative — an `IsAllDay` bool, or a nullable `To` meaning
midnight — adds a second representation of the same fact to every read.

### Deviation from the clients list

`ClientsPage` fetches `{id, name, region}` and then issues **one detail query
per row** to fill the Sídlo and Kontakty columns (`ClientsPage.tsx:95-105`).
The suppliers list needs strictly more per row — address, contacts, goods count
and the whole week of opening hours for the "Dnes" column — so repeating that
pattern would mean N+1 calls on every visit.

`SupplierListItemDto` therefore carries what the list renders. The payload stays
small (a supplier has at most ~14 interval rows) and it is one round trip. This
is a deliberate divergence from the neighbouring module, not an oversight.

### Rejected alternatives

**Make `Product.BreweryId` nullable and put CO₂ in the existing catalogue.**
This is what a later "buy from a supplier" slice will have to confront, and it is
the wrong change to smuggle in under a registry: every money-facing screen,
report projection and invoice line reads `Product` through its brewery today.

**A server-computed `IsOpenNow` on the DTO.** It would be stale the moment it is
cached (TanStack `staleTime` is 30 s) and it answers a question about the
*viewer's* clock from the server's. The frontend needs the weekly grid anyway,
so the same data serves both, and the logic is pure and unit-tested.

**One flat price table with a free-text good name.** Grouping would then rely on
matching strings, so a typo silently splits "CO₂ 10 kg" into two headings.

**A `Region` on the supplier, mirroring `Client`.** A client's region drives
shipment routing and report grouping. Nothing routes by supplier.

## Data model

All tables snake_case, ids `long` + `public_id` GUID, per existing convention.

```
suppliers                        (PublicSoftlyDeletableEntity)
  name                 varchar(50)   NOT NULL
  business_name        varchar(50)   NULL
  note                 varchar(500)  NULL   -- operational: "hlásit se na váhu"
  official_address_*   owned Address NOT NULL
  contact_address_*    owned Address NULL   -- the provozovna, when it differs
  is_deleted           bool

supplier_contacts                (BaseEntity)   -- mirrors client_contacts
  supplier_id, type, description varchar(50), value varchar(50) NOT NULL

supplier_opening_hours           (BaseEntity)
  supplier_id, day_of_week (System.DayOfWeek), from_time time, to_time time
  INDEX (supplier_id, day_of_week)

supplier_goods                   (PublicEntity)
  supplier_id, name varchar(50) NOT NULL, size varchar(20) NULL,
  description varchar(200) NULL
  INDEX (supplier_id)

supplier_good_prices             (BaseEntity)
  supplier_good_id, kind (SupplierChargeKind),
  price_with_vat numeric NOT NULL, price_without_vat numeric NULL,
  note varchar(100) NULL
  UNIQUE INDEX (supplier_good_id, kind)   -- one price per charge kind per good

supplier_notes                   (Note)         -- mirrors client_notes
  supplier_id, text varchar(1000), date_created
```

`System.DayOfWeek` is used rather than a new Monday-first enum — `Reminder`
already persists `List<DayOfWeek>`, so it is the established choice. The
Monday-first ordering the UI wants is a presentation concern.

Query filters follow `Client`: `suppliers` filters `!IsDeleted`, and each child
filters through the relationship (`!x.Supplier.IsDeleted`) so a soft-deleted
supplier takes its hours, goods and contacts out of every read.

`ModuleType.Suppliers` is **appended** to the enum. The values are persisted in
`user_module_permissions`, so inserting it in alphabetical position would
silently re-point every existing row — the same reason `Sales` sits last.

## API

All under `RequirePermission(ModuleType.Suppliers, …)`; `View` for reads, `Edit`
for writes. Errors use `ThrowHelper.PublicEntityNotFound`.

| Verb | Route | Body / returns |
|---|---|---|
| GET | `suppliers` | `List<SupplierListItemDto>` — id, name, businessName, officialAddress, contacts, goodsCount, openingHours |
| GET | `suppliers/{id}` | `SupplierDto` — the above plus contactAddress, note, goods with prices |
| POST | `suppliers` | `CreateSupplierDto` → 201 + publicId |
| PUT | `suppliers/{id}` | `UpdateSupplierDto` → 204 (name, businessName, note, both addresses, contacts) |
| DELETE | `suppliers/{id}` | 204, soft delete |
| PUT | `suppliers/{id}/opening-hours` | `ReplaceSupplierOpeningHoursDto` → 204 |
| POST | `suppliers/{id}/goods` | `CreateSupplierGoodDto` → 201 + publicId |
| PUT | `suppliers/{id}/goods/{goodId}` | `UpdateSupplierGoodDto` → 204 |
| DELETE | `suppliers/{id}/goods/{goodId}` | 204, hard delete |
| GET/POST/DELETE | `suppliers/{id}/notes[/{noteId}]` | mirrors the client-note endpoints |

**Opening hours are replaced as a whole week, not edited row by row.** The
editor is one form over the whole schedule, so a single PUT keeps the client
from having to diff intervals into per-row calls, and makes the overlap rule
checkable in one place. Same for a good's prices: they arrive with the good.

`GetNumberOfRecordsInEachModuleEndpoint` gains `SuppliersCount`, gated on
`CanSee(ModuleType.Suppliers)` like every other count.

### Validation

- Name required, ≤50. `BusinessName` ≤50. `Note` ≤500.
- Addresses via the existing `AddressValidator`.
- Contacts via the same rules as `CreateClientContactDto`.
- **Interval:** `From < To`, strictly.
- **No overlaps within a day.** Two intervals on the same weekday may touch
  (`11:30`/`12:00`) but not overlap. Without this, `isOpenNow` picks whichever
  interval sorts first and "closes" at the wrong time.
- **Good:** name required ≤50, size ≤20, description ≤200, **≥1 price**.
- **Prices:** `kind` unique within a good, `priceWithVat` ≥ 0 required,
  `priceWithoutVat` ≥ 0 when present, note ≤100.

## Frontend

`src/features/suppliers/`:

| File | Responsibility |
|---|---|
| `SuppliersPage.tsx` | list + detail router (`view` prop pattern), search, delete confirm |
| `SupplierDetail.tsx` | four tabs: Info a kontakty · Otevírací doba · Ceník · Poznámky |
| `SupplierFormDrawer.tsx` | name, business name, note, both addresses, contacts |
| `OpeningHoursDrawer.tsx` | whole-week editor: day + from + to rows, add/remove |
| `SupplierGoodDrawer.tsx` | good + its charge-kind price rows |
| `GoodsPricesPanel.tsx` | the Ceník table, goods grouped over their price rows |
| `OpeningHoursPanel.tsx` | banner + weekly grid, today highlighted |
| `supplierHours.ts` | **pure**: `weekdayIdx`, `hoursOfDay`, `isNonstop`, `hoursText`, `openState`, `openStateText` — ported from the prototype with its 30 assertions |
| `supplierGoods.ts` | **pure**: charge-kind ordering, cheapest fill, price counting |

Wiring: `MODULE_KEYS` + `PATHS.suppliers` + `NAV_GROUPS` (Evidence, between
Pivovary and Klienti) + `App`/routes + `KEY_TO_MODULE` in `permissionModel.ts` +
the users permission matrix + `qk.suppliers` + `useSuppliers.ts`.

Labels: `L.chargeKind` and `chargeKindLabel()` in `src/lib/labels.ts`; Czech
weekday names live with the hours module, which is the only consumer.

The Ceník table groups with `rowSpan` over each good's price rows, exactly as the
approved prototype does. Money goes through `useCurrency().formatMoney`, never a
local formatter.

The prototype's search normalises subscript digits (`supNorm`) so a keyboard
"co2" matches "CO₂"; the port keeps that, extending the existing diacritics fold.

## Testing

Backend (xUnit + Moq.EntityFrameworkCore, no DB): create/update/delete supplier,
the opening-hours replace including the overlap rejection and the `From >= To`
rejection, goods create/update/delete including duplicate-charge-kind rejection,
and the list/detail projections. Note the harness traps: `EndpointBuilder.Create`
ignores DI, and a `List<T>.AsQueryable()` breaks `ToListAsync` under the mock.

Frontend: `supplierHours.test.ts` ports the prototype's 30 assertions — the lunch
gap, the roll to the next open day, the Sunday skip, nonstop at 23:58, a supplier
with no hours. Plus `supplierGoods.test.ts`, and component tests for the page
(loading/error/empty via a mock that can express all three) and the two drawers.

## Found during implementation

**Soft delete was broken for every entity with an owned `Address` — including `Client`.**
Marking an entity `Deleted` cascades to its owned types, and an owned `Address` lives in the
owner's own table. `SoftlyDeleteBySettingFlag` flipped only the owner back to `Modified`, so
the owned entries stayed `Deleted` and EF wrote NULL into their columns in the same UPDATE:
`null value in column "official_address_street_name" violates not-null constraint`. Both
`DELETE /suppliers/{id}` and the pre-existing `DELETE /clients/{id}` answered 500.

Fixed in `AleTrackDbContext.KeepOwnedData`, which resets an entity's owned entries when the
delete is only a soft one. **The unit suite cannot see this class of bug at all** — it mocks
`DbSet` through Moq, so no change tracker exists to get it wrong, and 947 tests passed either
way. It was caught by a scripted round trip against a real Postgres.

Worth considering separately: a second test project with `Microsoft.EntityFrameworkCore.Sqlite`
would let change-tracker behaviour be asserted in CI. That is a new dependency and its own
decision, so it is recommended here rather than taken.

## Known gaps

- No purchase path (see Scope) — the registry records prices nobody yet spends.
- No reminders (see Scope).
- Opening hours have no holiday or exception dates; 24. 12. shows as a normal
  Thursday. Real, and deliberately deferred: exceptions need a date-keyed table
  and a merge rule, and the weekly grid is what the crew asked for.
- `PointMap` cannot plot outside the Liberec/Žitava bounds; a distant registered
  seat renders "Mimo mapu regionu" (fixed in the prototype in this change).
