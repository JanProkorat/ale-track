# Reporty prodejny — analytics for Garážový prodej

**Date:** 2026-08-16
**Status:** Design approved, ready for planning
**Depends on:** `2026-08-13-garage-sales-design.md` (the module being reported on),
`2026-08-14-sale-awaiting-payment-design.md` (the `Billing.PaidDate` this reads)

## Problem

Garážový prodej records every counter sale — what was sold, at what price, to
whom, paid how — but the module surfaces it only one sale at a time. There is no
view that answers the questions that decide what to reorder and who to chase:

- What did the counter take last month, and is it growing?
- Which invoices are still unpaid, and how old are they?
- What actually moves off the shelf, and what has been sitting there since spring?
- How much is being given away in counter discounts?

The existing Reporty module answers none of this: it aggregates **outgoing
shipments** (delivered volume per client, per brewery, incoming vs outgoing),
and it is gated by `ModuleType.Reports`, which counter staff have no reason to
hold. This spec adds a second, separate report page for the garage-sale side.

## Decisions

| Question | Decision |
|---|---|
| Shape | New page, three tabs, one shared period preset — the existing `ReportsPage` structure |
| Nav placement | `Garážový prodej` section, after **Prodeje**, labelled **Reporty prodejny** |
| Permission | `ModuleType.Sales` / `PermissionLevel.View` — no new permission row |
| Nav key | New `NavItem.permModule` field; `key` becomes a free string (see *Nav keying*) |
| Route (frontend) | `/sales-reports` |
| Routes (backend) | `reports/garage-sales/*`; the existing three move to `reports/shipments/*` |
| Money basis | With VAT throughout — the line only stores `UnitPriceWithVat` |
| Which sales count | `State == Completed` only. Drafts move no stock and are not revenue |
| Margin / profit | **Out of scope** — there is no cost basis in the schema (see *Non-goals*) |

### Rejected alternatives

**A fourth tab on the existing Reporty page.** It would put garage-sale numbers
behind the `Reports` permission and inside a page whose subtitle, period presets
and every existing tab speak about vývozy. The two report sets share a shape, not
an audience.

**Prefixing the shipment analytics with `sales/`.** In this codebase `sales`
already means garage sales — `ModuleType.Sales`, `Features/Sales/`, the `Sale`
entity. The nav section *Prodej* (objednávky + vývozy + reporty) is a UI grouping
with no backend domain behind it, so a `sales/` route prefix on shipment
analytics would read as counter data to anyone working in the API.

**A new `ModuleType.SalesReports`.** Cleanest separation, but it adds an
eleventh module that every role has to be configured for, to gate a read-only
view of data the same people already see sale-by-sale. `Sales: View` is the
right granularity.

## What the data supports

Verified against the entities, because most of the obvious "sales report"
metrics are not computable here.

**Available** — `Sale` (`SaleDate`, `State`, `BuyerKind`, `ClientId`, `Payment`,
`Billing.PaidDate`, `Billing.DueDate`, `CompletedAt`, `SoldByUserId`) and
`SaleItem` (`Name`, `Kind`, `PackageSize`, `Quantity`, `UnitPriceWithVat`,
`ListPriceWithVat`, `ProductId`, `InventoryItemId`).

`SaleItem.ListPriceWithVat` is snapshotted per line specifically so a discount
given at the counter stays visible after the ceník moves — that makes the
discount analysis real data rather than a reconstruction.

**Not available:**

- **No cost basis anywhere.** `DeliveryItem` records quantity, kind and package
  size but no purchase price; `InventoryItem` has no cost field. Margin, profit
  and markup are therefore un-computable without a schema change.
- **No stock ledger.** `InventoryItem.Quantity` is a current value that three
  writers mutate in place, with no history rows and no snapshots. Only
  *today's* stock can be related to a sales rate — a stock-level-over-time chart
  would have to invent its own history.
- **No VAT-exclusive line price.** `Product.PriceWithoutVat` exists, but the
  sale line snapshots only the with-VAT price, so a "bez DPH" toggle would be
  fabricated for historical rows.

## Nav keying

`NavItem.key` is typed `ModuleKey`, and `NAV_GROUPS` is the single source for
the sidebar, the command palette, the dashboard tiles and `PERM_MODULES` (the
permission matrix). Adding a second item keyed `'sales'` would produce a
duplicate row in the matrix and a duplicate dashboard tile.

```ts
export interface NavItem {
  key: string;                 // unique per nav item
  permModule?: ModuleKey;      // permission it gates on; defaults to `key`
  label: string;
  path: string;
  icon: ReactNode;
}
```

Consumers resolve `item.permModule ?? item.key`:

- `permissionModel.ts` — `PERM_MODULES` dedupes by resolved module, keeping ten rows.
- `RoleCapabilitiesDrawer.tsx` — same lookup.
- `DashboardPage.tsx` — the tile filter, so the page gets one Garážový prodej tile.
- `AppShell.tsx` — active-item matching is by `path`, untouched.

The new entry:

```tsx
{ key: 'salesReports', permModule: 'sales', label: 'Reporty prodejny',
  path: PATHS.salesReports, icon: <QueryStatsOutlinedIcon fontSize="small" /> }
```

`/sales-reports`, not `/sales/reports`: `/sales/:id` already exists, and although
React Router ranks a static segment above a dynamic one, a report route shaped
like a sale-detail route is a trap for whoever edits `router.tsx` next.

## Backend

### Route rename (existing endpoints)

| Now | After |
|---|---|
| `reports/delivery-volume` | `reports/shipments/delivery-volume` |
| `reports/client-volume` | `reports/shipments/client-volume` |
| `reports/operations` | `reports/shipments/operations` |
| `reports/number-of-records-in-each-module` | **unchanged** |

The counts endpoint feeds every module's sidebar badge and is not shipment
analytics, so it stays at the root of the prefix.

This is cheap: NSwag names client methods from `WithName(nameof(...))`, not from
the route (`getClientVolumeEndpoint` at `api-client.ts:2113` holds its URL as a
separate literal). Regeneration rewrites only that literal — no frontend hook or
call site moves. Two illustrative URL strings in `apiClient.test.ts:16-29` should
be updated to stay accurate; they would pass either way.

### New endpoints

Three query slices under `Features/Sales/Queries/Reports/{Revenue,Products,Buyers}/`.
They live in the Sales feature (whose permission and entities they use) while
their routes join the `reports/` family — the one place in this design where the
route prefix and the slice folder deliberately disagree, so that Swagger groups
all analytics together.

Every endpoint: `internal sealed`, primary-ctor `AleTrackDbContext`,
`DontCatchExceptions()`, `RequirePermission(ModuleType.Sales, PermissionLevel.View)`,
`.WithTag(_featureConfiguration)` (Sales), request derived from
`ReportWindowRequest`, and `State == Completed` on every aggregation. No driver
scoping — `Sale` has no driver link.

**`GET reports/garage-sales/revenue?From=&To=&Granularity=`**

```
GarageSalesRevenueReportDto
  TotalRevenue        decimal   // Σ Quantity × UnitPriceWithVat
  SalesCount          int
  AverageSale         decimal   // 0 when SalesCount is 0
  TotalUnits          int
  TotalLitres         double    // Σ Quantity × PackageSize, lines with a size
  Trend               [{ BucketStart, Revenue, SalesCount }]
  ByPayment           [{ Payment, Revenue, SalesCount }]     // Cash | Invoice
  UnpaidInvoices      [{ SaleId, SaleDate, DueDate, BuyerLabel, Amount, DaysOverdue }]
  UnpaidTotal         decimal
```

Bucketing reuses `ReportBucketing.RollUp`'s `BucketStart` (ISO Monday / 1st of
month) — the existing `DailyBucket`/`ReportSeriesPointDto` pair carries
weight+units, so revenue gets its own point record rather than bending that one.

`UnpaidInvoices` is deliberately **not** window-filtered: an unpaid invoice from
four months ago is exactly the row worth surfacing. Predicate:
`Payment == Invoice && Billing.PaidDate == null`, oldest first. `DaysOverdue` is
computed against the injected `TimeProvider`, negative meaning not yet due.

**`GET reports/garage-sales/products?From=&To=`**

```
GarageSalesProductsReportDto
  TopProducts   [{ ProductId?, Name, Kind?, Units, Litres, Revenue, DiscountTotal }]
  ByKind        [{ Kind?, Units, Litres, Revenue }]
  DiscountTotal decimal
  DiscountedRevenueShare decimal
  DeadStock     [{ InventoryItemId, Name, Quantity, UnitsSold, DaysOfCover? }]
```

Grouping key is `ProductId` where present, falling back to the snapshotted
`Name` — free-form stock (`Vratné basy`) has no product behind it and must still
aggregate. Discount per line is
`max(0, (ListPriceWithVat - UnitPriceWithVat)) × Quantity`, counted only where
`ListPriceWithVat` is non-null; a line sold *above* list is not a negative
discount.

`DeadStock` is every `InventoryItem` with `Quantity > 0` left-joined against
sold lines in the window; `DaysOfCover = Quantity ÷ (UnitsSold ÷ windowDays)`,
null when `UnitsSold` is 0 — never divide, and "never sold" is a distinct state
from "years of cover", shown as an em dash and sorted first.

**`GET reports/garage-sales/buyers?From=&To=`**

```
GarageSalesBuyersReportDto
  ByBuyerKind   [{ BuyerKind, Revenue, SalesCount }]        // Client | Walkin
  TopClients    [{ ClientId, ClientName, SalesCount, Revenue, LastPurchase }]
  RepeatBuyers  int    // clients with ≥2 completed sales in the window
  OneTimeBuyers int
```

Walk-ins are anonymous by design (`BuyerName` is optional), so they aggregate as
one bucket only — never as pseudo-clients keyed by a typed name.

### Aggregation placement

Projections stay in SQL; the roll-up runs in memory, matching
`GetClientVolumeEndpoint`'s rationale (week truncation is provider-specific, the
windows are small). Every read is `AsNoTracking()`.

## Frontend

New feature folder `src/features/salesReports/`:

| File | Responsibility |
|---|---|
| `SalesReportsPage.tsx` | `SegControl` tabs + period preset, one enabled query at a time, `QueryBoundary` per tab |
| `RevenueTab.tsx` | KPI row, trend chart, payment split, unpaid-invoice table |
| `ProductsTab.tsx` | Top products, kind breakdown, discount card, dead-stock table |
| `BuyersTab.tsx` | Buyer-kind split, top clients, repeat vs one-time |
| `salesReportModel.ts` | Pure arithmetic: discount share, days-of-cover formatting, tab/period option tables, KPI shaping |

Hooks in `src/hooks/useSalesReports.ts` (`useGarageSalesRevenue`,
`useGarageSalesProducts`, `useGarageSalesBuyers`), each taking an `enabled` flag
so only the active tab fetches — the pattern `ReportsPage` already uses.

Query keys, nested so `qk.sales.all` invalidation after completing a sale also
refreshes the reports:

```ts
salesReportRevenue:  (p: Params = {}) => ['sales', 'reports', 'revenue', p] as const,
salesReportProducts: (p: Params = {}) => ['sales', 'reports', 'products', p] as const,
salesReportBuyers:   (p: Params = {}) => ['sales', 'reports', 'buyers', p] as const,
```

Reuse, not re-implementation:

- `PageContainer` / `PageHeader` (eyebrow **Garážový prodej**, title **Reporty
  prodejny**), `SegControl`, `ChartCard`, `DataTable`, `EmptyState`.
- `periodRange`, `PERIOD_OPTIONS`, `PERIOD_LABEL`, `bandAxisWidth`,
  `bucketLabel`, `sharePct`, `MONTH_ABBR` imported from
  `features/reports/reportModel`. If a third consumer ever appears, lift them to
  `src/lib`; not before.
- `reportPalette` for series colour, **assigned by product identity** — never
  cycled with `%` and never assigned after sorting by value, or changing the
  period repaints every series (`app/CLAUDE.md`).
- `useCurrency().formatMoney` for every money value. No local currency
  formatting.
- Status colours (overdue chips on the unpaid table) come from the theme's
  status tokens, not from `reportPalette`.

Unpaid-invoice rows and top-client rows link to `/sales/{id}` and `/clients/{id}`
via `routeLinks`. Czech copy throughout; no raw enums — `Payment`, `BuyerKind`
and `ProductKind` render through `src/lib/labels.ts`, extended where a label is
missing.

## Non-goals

- **Marže / zisk.** No cost basis exists (see *What the data supports*). Adding
  a purchase price to `DeliveryItem` is a schema change with its own migration
  and backfill question — a separate work item, noted below.
- **Vývoj skladu v čase.** No stock ledger.
- **Per-seller breakdown** (`SoldByUserId`). Possible, but with this team it is
  a table row rather than a tab; deferred until asked for.
- **Export to Excel/PDF.** Not requested; the shipment Reporty has none either.
- **Storno / refund handling.** Doesn't exist in the module yet.

## Testing

**Backend** (xUnit + FluentAssertions + Moq.EntityFrameworkCore, no DB):

- Draft sales excluded from every aggregate.
- Unpaid list ignores the date window; excludes cash sales and paid invoices;
  `DaysOverdue` from a pinned `TimeProvider`, including a not-yet-due negative.
- Discount counted only where `ListPriceWithVat` is non-null; a line sold above
  list contributes zero, not a negative.
- Free-form line (no `ProductId`) aggregates under its snapshotted name.
- Dead stock: an item with stock and no sales appears with a null `DaysOfCover`;
  an item sold in the window does not.
- Empty window returns zeroed totals and empty lists, not nulls.
- 403 without `Sales: View`; 200 with it.
- The renamed shipment routes still answer at their new paths.

**Frontend** (Vitest + happy-dom + Testing Library, `fireEvent`, no
`user-event`):

- `salesReportModel.test.ts` for the pure arithmetic and formatting.
- Tab tests with the resource hook mocked across **loading / error / no-data /
  data** — a happy-path-only mock cannot catch the missing-data crash.
- `permissionModel.test.ts` extended: the matrix still has ten rows with two nav
  items resolving to `sales`.
- Page test: switching tabs enables exactly one query.

Verification per `rules/verification-contract.md`: `dotnet-verify` for `api/**`
and `react-verify` for `app/**` — this work item touches both.

## Known gaps / follow-ups

1. **Purchase price on deliveries** — the prerequisite for any margin reporting.
   Schema change plus a decision about historical rows.
2. **Stock movement ledger** — already noted as a known gap in the garage-sales
   spec; it would make stock-over-time and true turnover computable, and would
   replace the current-quantity approximation in `DeadStock`.
3. **Period presets** are shared with the shipment Reporty (30 / 90 / 180 days).
   A counter operator may want "this month" / "last month"; deferred until asked.
