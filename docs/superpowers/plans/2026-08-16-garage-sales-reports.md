# Reporty prodejny Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a three-tab analytics page for Garážový prodej, gated by `Sales: View`, backed by three new report endpoints, and disambiguate the existing shipment-report routes.

**Architecture:** Three new FastEndpoints query slices under `Features/Sales/Queries/Reports/`, routed into the `reports/garage-sales/*` family. A new React feature folder `src/features/salesReports/` mirrors the existing `ReportsPage` shape — tabbed shell, one enabled query at a time, pure shaping logic in a sibling model module. `NavItem` grows an optional `permModule` so a second nav item can gate on `sales` without duplicating a `ModuleKey`.

**Tech Stack:** .NET 10 / FastEndpoints / EF Core (backend); React 19 / MUI 7 / TanStack Query 5 / @mui/x-charts (frontend); xUnit + Moq.EntityFrameworkCore, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-16-garage-sales-reports-design.md`

**Branch:** `feature/garage-sales-reports`

## Global Constraints

- Every new endpoint: `internal sealed`, `DontCatchExceptions()`, `RequirePermission(ModuleType.Sales, PermissionLevel.View)`, `.WithTag(_featureConfiguration)`, request derived from `ReportWindowRequest`.
- Every aggregation filters `State == SaleState.Completed`. Drafts are never revenue.
- All reads `AsNoTracking()`. Projections in SQL, roll-up in memory.
- Money is with VAT throughout. Frontend renders it only via `useCurrency().formatMoney`.
- UI copy is Czech; code, comments and commit messages are English.
- No raw enums in the UI — labels go through `src/lib/labels.ts`.
- Chart colours from `reportPalette`, assigned by entity identity, never after sorting by value.
- No `any`, no hardcoded hex/spacing, no hand-edits to `src/generated/api-client.ts`.
- Never stage `appsettings.*.json`, `Program.cs` or `launchSettings.json` — they carry unrelated local config.

---

### Task 1: Rename the shipment report routes

**Files:**
- Modify: `api/AleTrack/AleTrack/Features/Reports/Queries/DeliveryVolume/GetDeliveryVolumeEndpoint.cs:33`
- Modify: `api/AleTrack/AleTrack/Features/Reports/Queries/ClientVolume/GetClientVolumeEndpoint.cs:27`
- Modify: `api/AleTrack/AleTrack/Features/Reports/Queries/Operations/GetOperationsEndpoint.cs:30`
- Test: `api/AleTrack/AleTrack.Tests/` — existing report endpoint tests must stay green

**Interfaces:**
- Produces: routes `reports/shipments/delivery-volume`, `reports/shipments/client-volume`, `reports/shipments/operations`. Endpoint class names and `WithName` values are unchanged, so generated client method names do not move.

- [ ] **Step 1:** Change the three `Get("reports/...")` calls to their `reports/shipments/...` form. Leave `GetNumberOfRecordsInEachModuleEndpoint` at `reports/number-of-records-in-each-module`.
- [ ] **Step 2:** Run `dotnet build AleTrack.sln` from `api/AleTrack/` — expect success.
- [ ] **Step 3:** Run the existing report tests: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~Reports"` — expect pass (they construct endpoints directly and do not assert routes).
- [ ] **Step 4:** Commit.

---

### Task 2: Revenue endpoint

**Files:**
- Create: `api/AleTrack/AleTrack/Features/Sales/Queries/Reports/Revenue/GetGarageSalesRevenueEndpoint.cs`
- Create: `api/AleTrack/AleTrack/Features/Sales/Queries/Reports/Revenue/GarageSalesRevenueReportDto.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/Sales/Reports/GetGarageSalesRevenueEndpointTests.cs`

**Interfaces:**
- Consumes: `ReportWindowRequest`, `ReportGranularity`, `ReportBucketing.BucketStart` from `Features/Reports/Utils/ReportWindow.cs`.
- Produces: `GET reports/garage-sales/revenue?From=&To=&Granularity=` → `GarageSalesRevenueReportDto { TotalRevenue: decimal, SalesCount: int, AverageSale: decimal, TotalUnits: int, TotalLitres: double, Trend: List<RevenueSeriesPointDto{BucketStart: DateOnly, Revenue: decimal, SalesCount: int}>, ByPayment: List<RevenueByPaymentDto{Payment: SalePaymentMethod, Revenue: decimal, SalesCount: int}>, UnpaidInvoices: List<UnpaidInvoiceRowDto{SaleId: Guid, SaleDate: DateOnly, DueDate: DateOnly?, BuyerLabel: string, Amount: decimal, DaysOverdue: int}>, UnpaidTotal: decimal }`

- [ ] **Step 1: Write the failing tests.** Cover: drafts excluded from totals; `AverageSale` is 0 on an empty window; week bucketing groups two sales in one ISO week; `ByPayment` splits cash and invoice; unpaid list ignores the window and excludes paid invoices and cash sales; `DaysOverdue` is negative for a not-yet-due invoice (pinned `TimeProvider`).

```csharp
[Fact]
public async Task HandleAsync_DraftSale_ExcludedFromRevenue()
{
    var endpoint = CreateEndpoint(sales: [CompletedSale(200m), DraftSale(999m)]);
    await endpoint.HandleAsync(Window("2026-08-01", "2026-08-31"), CancellationToken.None);
    endpoint.Response.TotalRevenue.Should().Be(200m);
    endpoint.Response.SalesCount.Should().Be(1);
}
```

- [ ] **Step 2:** Run `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~GetGarageSalesRevenueEndpointTests"` — expect FAIL (type does not exist).
- [ ] **Step 3:** Write the DTO record and the endpoint. Project sale-level rows in SQL (`SaleDate`, `Payment`, `PublicId`, buyer label, `Billing.PaidDate`, `Billing.DueDate`, line sum), aggregate in memory. `AverageSale` guards a zero count. Litres = `Σ Quantity × PackageSize` over lines with a size.
- [ ] **Step 4:** Run the same filter — expect PASS.
- [ ] **Step 5:** Commit.

---

### Task 3: Products endpoint

**Files:**
- Create: `api/AleTrack/AleTrack/Features/Sales/Queries/Reports/Products/GetGarageSalesProductsEndpoint.cs`
- Create: `api/AleTrack/AleTrack/Features/Sales/Queries/Reports/Products/GarageSalesProductsReportDto.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/Sales/Reports/GetGarageSalesProductsEndpointTests.cs`

**Interfaces:**
- Produces: `GET reports/garage-sales/products?From=&To=` → `GarageSalesProductsReportDto { TopProducts: List<ProductSalesRowDto{ProductId: Guid?, Name: string, Kind: ProductKind?, Units: int, Litres: double, Revenue: decimal, DiscountTotal: decimal}>, ByKind: List<SalesByKindDto{Kind: ProductKind?, Units: int, Litres: double, Revenue: decimal}>, DiscountTotal: decimal, DiscountedRevenueShare: decimal, DeadStock: List<DeadStockRowDto{InventoryItemId: Guid, Name: string, Quantity: int, UnitsSold: int, DaysOfCover: double?}> }`

- [ ] **Step 1: Write the failing tests.** Cover: grouping falls back to the snapshotted name when `ProductId` is null; discount counted only where `ListPriceWithVat` is non-null; a line sold above list contributes zero discount, not a negative; dead stock lists an in-stock item with no sales and a null `DaysOfCover`; an item sold in the window is not dead stock; `DaysOfCover` divides current quantity by the daily sales rate.

```csharp
[Fact]
public async Task HandleAsync_LineSoldAboveListPrice_ContributesNoDiscount()
{
    var endpoint = CreateEndpoint(sales: [CompletedSaleWithLine(unitPrice: 120m, listPrice: 100m, quantity: 2)]);
    await endpoint.HandleAsync(Window("2026-08-01", "2026-08-31"), CancellationToken.None);
    endpoint.Response.DiscountTotal.Should().Be(0m);
}
```

- [ ] **Step 2:** Run the filter — expect FAIL.
- [ ] **Step 3:** Implement. Group key `ProductId?.ToString() ?? Name`. Discount per line `Math.Max(0, list - unit) * quantity`. Dead stock joins `InventoryItem` (`Quantity > 0`) against sold `InventoryItemId`s; `DaysOfCover` null when `UnitsSold == 0`, ordered nulls first.
- [ ] **Step 4:** Run the filter — expect PASS.
- [ ] **Step 5:** Commit.

---

### Task 4: Buyers endpoint

**Files:**
- Create: `api/AleTrack/AleTrack/Features/Sales/Queries/Reports/Buyers/GetGarageSalesBuyersEndpoint.cs`
- Create: `api/AleTrack/AleTrack/Features/Sales/Queries/Reports/Buyers/GarageSalesBuyersReportDto.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/Sales/Reports/GetGarageSalesBuyersEndpointTests.cs`

**Interfaces:**
- Produces: `GET reports/garage-sales/buyers?From=&To=` → `GarageSalesBuyersReportDto { ByBuyerKind: List<BuyerKindRowDto{BuyerKind: SaleBuyerKind, Revenue: decimal, SalesCount: int}>, TopClients: List<BuyerClientRowDto{ClientId: Guid, ClientName: string, SalesCount: int, Revenue: decimal, LastPurchase: DateOnly}>, RepeatBuyers: int, OneTimeBuyers: int }`

- [ ] **Step 1: Write the failing tests.** Cover: walk-ins aggregate into one bucket regardless of typed name; a client with two completed sales counts as a repeat buyer; `LastPurchase` is the newest sale date; drafts excluded.
- [ ] **Step 2:** Run the filter — expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the filter — expect PASS.
- [ ] **Step 5:** Run the full backend suite (`dotnet test AleTrack.Tests/AleTrack.Tests.csproj`) and commit.

---

### Task 5: Nav keying and route

**Files:**
- Modify: `app/src/layout/nav-config.tsx` (NavItem type + new entry)
- Modify: `app/src/features/users/permissionModel.ts:19`
- Modify: `app/src/features/users/RoleCapabilitiesDrawer.tsx:37`
- Modify: `app/src/pages/DashboardPage.tsx:142`
- Modify: `app/src/routes/paths.ts`, `app/src/routes/router.tsx`
- Test: `app/src/features/users/permissionModel.test.ts`

**Interfaces:**
- Produces: `NavItem { key: string; permModule?: ModuleKey; label: string; path: string; icon: ReactNode }`, `PATHS.salesReports = '/sales-reports'`, and a `navPermModule(item)` helper exported from `nav-config.tsx` returning `item.permModule ?? (item.key as ModuleKey)`.

- [ ] **Step 1: Write the failing test** — `PERM_MODULES` still has exactly ten entries and contains no duplicate module while `NAV_GROUPS` carries two `sales`-gated items.
- [ ] **Step 2:** Run `yarn test:run --run src/features/users/permissionModel.test.ts` — expect FAIL.
- [ ] **Step 3:** Widen `NavItem`, add `navPermModule`, dedupe in `PERM_MODULES`, update the two other consumers, add `PATHS.salesReports`, add the nav entry (icon `QueryStatsOutlinedIcon`, label `Reporty prodejny`, after Prodeje) and the router entry pointing at `SalesReportsPage`.
- [ ] **Step 4:** Run the test — expect PASS.
- [ ] **Step 5:** Commit (router entry may be added in Task 9 if the page does not exist yet — keep the import compiling).

---

### Task 6: Regenerate the API client

**Files:**
- Modify: `app/src/generated/api-client.ts` (generated — never hand-edited)
- Modify: `app/src/api/apiClient.test.ts:16-29` (illustrative URLs)

- [ ] **Step 1:** Start the backend: `dotnet run --project AleTrack --launch-profile Local` from `api/AleTrack/`, confirm `http://localhost:8080/swagger/v1/swagger.json` responds and nothing else holds :8080.
- [ ] **Step 2:** `cd app && yarn generate-api`.
- [ ] **Step 3:** Confirm the diff carries the three new operations plus the three renamed URLs and no unrelated churn.
- [ ] **Step 4:** Update the two sample URLs in `apiClient.test.ts` to the `reports/shipments/...` form; run `yarn test:run --run src/api/apiClient.test.ts` — expect PASS.
- [ ] **Step 5:** Commit.

---

### Task 7: Hooks, query keys and the pure model

**Files:**
- Create: `app/src/hooks/useSalesReports.ts`
- Create: `app/src/features/salesReports/salesReportModel.ts`
- Modify: `app/src/api/queryKeys.ts`
- Test: `app/src/features/salesReports/salesReportModel.test.ts`

**Interfaces:**
- Produces: `useGarageSalesRevenue(from, to, granularity, enabled)`, `useGarageSalesProducts(from, to, enabled)`, `useGarageSalesBuyers(from, to, enabled)`; keys `qk.salesReportRevenue/Products/Buyers`; from the model: `SALES_TAB_OPTIONS`, `type SalesReportTab = 'revenue' | 'products' | 'buyers'`, `fmtDaysOfCover(days: number | null | undefined): string`, `overdueTone(daysOverdue: number): 'crit' | 'warn' | 'none'`, `discountShare(discount: number, revenue: number): string`.

- [ ] **Step 1: Write the failing model tests** — `fmtDaysOfCover(null)` is `'—'`, rounds to whole days, and caps absurd values; `overdueTone` boundaries at 0 and 30; `discountShare` is safe on a zero revenue.
- [ ] **Step 2:** Run `yarn test:run --run src/features/salesReports/salesReportModel.test.ts` — expect FAIL.
- [ ] **Step 3:** Implement the model, the keys and the hooks (each hook takes `enabled`).
- [ ] **Step 4:** Run the test — expect PASS.
- [ ] **Step 5:** Commit.

---

### Task 8: The three tabs

**Files:**
- Create: `app/src/features/salesReports/RevenueTab.tsx`, `ProductsTab.tsx`, `BuyersTab.tsx`
- Test: `app/src/features/salesReports/RevenueTab.test.tsx`, `ProductsTab.test.tsx`, `BuyersTab.test.tsx`

**Interfaces:**
- Consumes: the three DTOs from Task 6's regenerated client, `salesReportModel` helpers from Task 7.
- Produces: `RevenueTab({ data, granularity, onGranularityChange })`, `ProductsTab({ data })`, `BuyersTab({ data })` — each takes loaded data as a plain prop and calls no query hook.

- [ ] **Step 1: Write the failing tests** — RevenueTab renders the KPI row and an empty-state instead of the unpaid table when `UnpaidInvoices` is empty; ProductsTab renders an em dash for a null `DaysOfCover`; BuyersTab renders the walk-in bucket without a client link.
- [ ] **Step 2:** Run the three test files — expect FAIL.
- [ ] **Step 3:** Implement the tabs using `ChartCard`, `DataTable`, `EmptyState`, `formatMoney`, `reportPalette` (by identity), status tokens for overdue chips, `routeLinks` for sale/client links.
- [ ] **Step 4:** Run the three test files — expect PASS.
- [ ] **Step 5:** Commit.

---

### Task 9: The page shell and routing

**Files:**
- Create: `app/src/features/salesReports/SalesReportsPage.tsx`
- Test: `app/src/features/salesReports/SalesReportsPage.test.tsx`
- Modify: `app/src/routes/router.tsx` (if not already wired in Task 5)

- [ ] **Step 1: Write the failing test** — mock the three hooks so each can express loading / error / no-data / data; assert only the active tab's hook is enabled and that switching tabs flips which one is.
- [ ] **Step 2:** Run it — expect FAIL.
- [ ] **Step 3:** Implement the shell: `PageContainer`, `PageHeader` (eyebrow `Garážový prodej`, title `Reporty prodejny`, subtitle naming the period), tab + period `SegControl`s, `QueryBoundary` per tab.
- [ ] **Step 4:** Run it — expect PASS.
- [ ] **Step 5:** Commit.

---

### Task 10: Full verification

- [ ] **Step 1:** `dotnet-verify` for `api/**` — full suite, read the whole output.
- [ ] **Step 2:** `react-verify` for `app/**` — `yarn build`, `yarn lint`, `yarn test:run`.
- [ ] **Step 3:** Fix anything red; do not suppress a lint or type error to get green.
- [ ] **Step 4:** Commit any fixes.
