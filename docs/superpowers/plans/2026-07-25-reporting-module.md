# Reporting module (Reporty) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a read-only analytics module (Reporty) with three tabs — Objem,
Klienti, Provoz — backed by three new aggregation endpoints, matching the
approved prototype.

**Architecture:** Three independent FastEndpoints query endpoints under
`Features/Reports/Queries/`, each taking the same `from`/`to` window. Each handler
projects raw columns out of SQL and aggregates **in C#**, because the weight
figure comes from an unmapped computed property (see Global Constraints). The
frontend adds a `reports` module: one tabbed page, one hook per endpoint, charts
via `@mui/x-charts`.

**Tech Stack:** .NET 10 / FastEndpoints / EF Core + Npgsql; xUnit + FluentAssertions
+ Moq.EntityFrameworkCore. React 19 / MUI 7 / TanStack Query 5 / `@mui/x-charts` v8;
Vitest + happy-dom + Testing Library.

**Source spec:** `docs/superpowers/specs/2026-07-24-reporting-module-design.md`
(approved). **Prototype:** `docs/prototype/aletrack-prototype.html` lines 779–971,
route `#/reports`.

## Global Constraints

- **`Product.Weight` is an unmapped computed C# property** (`Entities/Product.cs:104`).
  It **cannot** appear in any EF `Where`/`GroupBy`/`Sum` — Npgsql throws at runtime.
  Every handler must `Select` raw columns (`Kind`, `PackageSize`, `Quantity`, …),
  `ToListAsync`, then compute weight in memory.
  **`Moq.EntityFrameworkCore` will NOT catch a violation** — mocked DbSets are
  LINQ-to-objects, so a computed property evaluates fine in tests and explodes in
  production. This is the single highest-risk trap in this plan.
- **Npgsql rejects `DateTimeKind.Unspecified` against a `timestamptz` column.**
  `OutgoingShipment.DeliveryDate` is `timestamp with time zone`, and
  `EnableLegacyTimestampBehavior` is not set anywhere in this solution. So
  `DateOnly.ToDateTime(TimeOnly.MinValue)` — which returns `Kind=Unspecified` — throws
  *"Cannot write DateTime with Kind=Unspecified"* the moment the query runs. Always use
  the three-arg overload: `from.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc)`.
  **And never call `DateOnly.FromDateTime` on a mapped column inside a projection** —
  either it fails to translate, or it becomes a `::date` cast whose result depends on the
  session `TimeZone`, making day/week bucketing non-deterministic. Carry the raw
  `DateTime` out of SQL and derive the day in memory. Both mistakes are invisible to
  `Moq.EntityFrameworkCore` for the same reason the weight trap is.
- **Weight logic must not be duplicated.** Task 1 extracts `Product.Weight`'s switch
  into `ProductWeightCalculator.Compute(ProductKind, double?)` and has
  `Product.Weight` delegate to it. Reports call the same static.
- **"Delivered" = actuals only:** `OutgoingShipment.State == OutgoingShipmentState.Delivered`
  **and** `DeliveryDate` within `[from, to]`. Never `Order.ActualDeliveryDate`.
- **Order stops only:** `OutgoingShipmentStop.Kind == OutgoingShipmentStopKind.Order`
  (`ClientOrderId != null`). Custom stops carry no products.
- **v1 counts order-line products only** — `OutgoingShipmentCustomExtraItem` and
  `OutgoingShipmentClientExtraItem` are excluded by design (documented spec
  limitation). Say so in a code comment in each handler.
- **Both sides of `IncomingVsOutgoing` are actuals.** Outgoing counts `Delivered` shipments;
  incoming must likewise count only `ProductDeliveryState.Finished` deliveries. The two
  series share one kilogram axis, so mixing planned/cancelled Dovozy with delivered Vyvozy
  would compare unlike quantities.
- **On-time:** % of `OrderState.Finished` orders with
  `ActualDeliveryDate <= RequiredDeliveryDate`; orders with a null
  `RequiredDeliveryDate` are excluded from both numerator and denominator.
- **Bucketing:** aggregate by day, then roll up to week/month **in C#** — no
  DB-specific date truncation.
- **UI is Czech, code is English.** Never render a raw enum — go through
  `src/lib/labels.ts` (`ptypeLabel`, `kindLabel`, `regionLabel`, `shipStateName`,
  `SHIP_STATUS`) and `src/lib/format.ts` (`num`, `plural`).
- **`@mui/x-charts` version: `^8.29.0`** (`latest-v8`). Do **not** install `latest`
  (9.x) — it peer-requires `@mui/material` `^7.3.0 || ^9.0.0` while this repo is on
  `^7.1.0`, and 8.x matches the installed `@mui/x-date-pickers` `^8.4.0` cadence.
- **NSwag serializes the reports' `DateOnly` query params as full ISO instants, which the
  backend cannot bind.** The generated methods type `from`/`to` as `Date` and emit
  `From=` + `from.toISOString()` → `2026-07-25T00:00:00.000Z`. `DateOnly.TryParse` rejects
  that (verified: it returns `false`), so all three report endpoints would fail to bind.
  Fix it in `app/src/api/apiClient.ts`'s fetch layer — the same documented seam that already
  repairs NSwag's dictionary-query-param defect — by trimming those values to the calendar
  day. `From`/`To` appear **only** on the three report endpoints, so the rewrite is scoped.
  Never hand-edit the generated client.
- **The generated signatures are not what this plan originally guessed.** The real ones are
  `getDeliveryVolumeEndpoint(granularity: ReportGranularity, from: Date, to: Date, signal?)`
  — **granularity first** — plus `getClientVolumeEndpoint(from: Date, to: Date, signal?)` and
  `getOperationsEndpoint(from: Date, to: Date, signal?)`. `ReportGranularity` is a numeric
  enum (`Day = 0, Week = 1, Month = 2`) and `ModuleType.Reports = 9`.
- **Use `theme.vars.palette.*`, never `theme.palette.*`, inside `sx` callbacks** —
  under `cssVariables` the latter freezes to the light value.
- **Chart palette is fixed and validated — do not invent hues.** Categorical series
  use the 7-slot order in Task 5 (`reportPalette.ts`), assigned **by entity
  identity, never by rank and never cycled**. Status colours (shipment state,
  on-time gauge) come from the theme's status tokens, never from the categorical
  palette.
- **A legend is mandatory wherever ≥2 series share a chart** (donuts, grouped bars).
  In light mode the amber and sky-blue slots sit below 3:1 against a white card, so
  the legend's visible labels are the required relief — they are not optional
  decoration.
- **Never a dual-axis chart.** The dovoz/vývoz chart plots two series in the same
  unit (kg) on one axis.
- Backend endpoints are `RequireAuthenticated()` only, consistent with every other
  endpoint; `reports` gains a client-side `view` permission for nav/route gating.
- Every task ends green: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj` for
  backend tasks, `yarn test:run && yarn build` for frontend tasks.

## Known pre-existing issues (do NOT fix here)

- `Features/Products/Utils/PackageWeight.cs:12` — `FiveKilos = 2`. A 5 l keg is
  therefore weighed at 2 kg. Wrong-looking, but it is the current production
  figure and reports must match the rest of the app. Flag it to the user; do not
  change it inside this plan.
- The reporting spec's Provoz section still says `returnableUnits` sums
  `OutgoingShipmentReturn.Quantity`. That entity exists on `dev` today, so Task 3
  is written against it. The `feat/order-returns` branch renames it to `OrderReturn`
  hanging off `Order`; if that lands on `dev` first, Task 3's returns query changes
  from `shipment.Returns` to `stop.ClientOrder.Returns`. Nothing else moves.

---

## File Structure

**Backend — create:**

| File | Responsibility |
|---|---|
| `AleTrack/Features/Products/Utils/ProductWeightCalculator.cs` | The single source of truth for kind+size → kg. |
| `AleTrack/Features/Reports/Utils/ReportWindow.cs` | Shared `from`/`to` request base + day/week/month bucket roll-up helpers. |
| `AleTrack/Features/Reports/Utils/DeliveredLineRow.cs` | The flat row every volume query projects into. |
| `AleTrack/Features/Reports/Queries/DeliveryVolume/GetDeliveryVolumeEndpoint.cs` + `DeliveryVolumeReportDto.cs` | Objem tab. |
| `AleTrack/Features/Reports/Queries/ClientVolume/GetClientVolumeEndpoint.cs` + `ClientVolumeReportDto.cs` | Klienti tab. |
| `AleTrack/Features/Reports/Queries/Operations/GetOperationsEndpoint.cs` + `OperationsReportDto.cs` | Provoz tab. |

**Backend — modify:** `AleTrack/Entities/Product.cs` (delegate `Weight`).

**Backend — test:** `AleTrack.Tests/Features/Reports/DeliveryVolumeReportTests.cs`,
`ClientVolumeReportTests.cs`, `OperationsReportTests.cs`,
`AleTrack.Tests/Builders/DeliveredShipmentBuilder.cs` (new fixture builder).

**Frontend — create:**

| File | Responsibility |
|---|---|
| `app/src/features/reports/ReportsPage.tsx` | Control row (tabs + period), routes to a tab. |
| `app/src/features/reports/VolumeTab.tsx` / `ClientsTab.tsx` / `OperationalTab.tsx` | One tab each. |
| `app/src/features/reports/reportModel.ts` | Pure shaping: period → dates, kg formatting, share %, roll-ups. |
| `app/src/features/reports/reportPalette.ts` | The validated 7-slot categorical palette + stable type→slot map. |
| `app/src/features/reports/ChartCard.tsx` | The prototype's `.card` + `.card-head` wrapper used by every chart. |

**Frontend — modify:** `src/auth/permissions.ts`, `src/routes/paths.ts`,
`src/layout/nav-config.tsx`, `src/routes/router.tsx`, `src/api/queryKeys.ts`,
`src/hooks/useReports.ts`, `src/generated/api-client.ts` (regenerated), `package.json`.

**Frontend — test:** `reportModel.test.ts`, `reportPalette.test.ts`,
`ReportsPage.test.tsx`, `VolumeTab.test.tsx`, `ClientsTab.test.tsx`,
`OperationalTab.test.tsx`.

---

## Task 1: Weight calculator + delivery-volume endpoint (Objem)

**Files:**
- Create: `api/AleTrack/AleTrack/Features/Products/Utils/ProductWeightCalculator.cs`
- Modify: `api/AleTrack/AleTrack/Entities/Product.cs:104-129` (delegate `Weight`)
- Create: `api/AleTrack/AleTrack/Features/Reports/Utils/ReportWindow.cs`
- Create: `api/AleTrack/AleTrack/Features/Reports/Utils/DeliveredLineRow.cs`
- Create: `api/AleTrack/AleTrack/Features/Reports/Queries/DeliveryVolume/DeliveryVolumeReportDto.cs`
- Create: `api/AleTrack/AleTrack/Features/Reports/Queries/DeliveryVolume/GetDeliveryVolumeEndpoint.cs`
- Create: `api/AleTrack/AleTrack.Tests/Builders/DeliveredShipmentBuilder.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/Reports/DeliveryVolumeReportTests.cs`

**Interfaces:**
- Produces:
  - `ProductWeightCalculator.Compute(ProductKind kind, double? packageSize) → double?`
  - `abstract record ReportWindowRequest { DateOnly From; DateOnly To; }`
  - `ReportBucketing.RollUp(IEnumerable<DailyBucket> daily, ReportGranularity g) → List<ReportSeriesPointDto>`
  - `enum ReportGranularity { Day, Week, Month }`
  - `record DeliveredLineRow(DateOnly Date, long ClientId, long BreweryId, string BreweryName, string? BreweryColor, ProductKind Kind, ProductType Type, int Quantity, double? PackageSize)`
  - `DeliveredLineQuery.Project(AleTrackDbContext db, DateOnly from, DateOnly to) → IQueryable<DeliveredLineRow>`
  - `DeliveryVolumeReportDto { decimal TotalWeightKg; int TotalUnits; int ClientsServed; List<VolumeByKindDto> UnitsByKind; List<VolumeByBreweryDto> ByBrewery; List<VolumeByTypeDto> ByType; List<ReportSeriesPointDto> Series; }`
  - Route: `GET reports/delivery-volume?From=&To=&Granularity=`
- Consumes: nothing (first task).

**Deviation from spec to record in the commit message:** the spec's
`DeliveryVolumeReportDto` has no `ClientsServed`, but the prototype's first KPI
reads "*N* klientů obslouženo" (line 896). Added to this DTO rather than making the
Objem tab fetch the Klienti endpoint too.

- [ ] **Step 1: Write the failing test — weight calculator is the single source of truth**

`api/AleTrack/AleTrack.Tests/Features/Reports/DeliveryVolumeReportTests.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Features.Products.Utils;
using FluentAssertions;

namespace AleTrack.Tests.Features.Reports;

public sealed class ProductWeightCalculatorTests
{
    [Theory]
    [InlineData(ProductKind.Keg, KegSize.FiftyLiters, PackageWeight.SixtyTwoKilos)]
    [InlineData(ProductKind.Keg, KegSize.ThirtyLiters, PackageWeight.FortyTwoKilos)]
    [InlineData(ProductKind.Bottle, BottleSize.OneLiter, PackageWeight.OneKilo)]
    [InlineData(ProductKind.Can, CanSize.ZeroPointFiveLiters, PackageWeight.ZeroPointFive)]
    public void Compute_ReturnsWeight_ForKnownKindAndSize(ProductKind kind, double size, double expected)
    {
        ProductWeightCalculator.Compute(kind, size).Should().Be(expected);
    }

    [Fact]
    public void Compute_ReturnsNull_WhenPackageSizeMissing()
    {
        ProductWeightCalculator.Compute(ProductKind.Keg, null).Should().BeNull();
    }

    [Fact]
    public void Compute_ReturnsNull_ForUnknownCombination()
    {
        ProductWeightCalculator.Compute(ProductKind.Multipack, 6).Should().BeNull();
    }

    [Fact]
    public void ProductWeight_ReturnsTheMappedWeight()
    {
        // Asserts the literal, not `== Compute(...)`, so a wrong mapping fails the test
        // rather than only a removed delegation.
        var product = new Product { Kind = ProductKind.Keg, PackageSize = KegSize.FiftyLiters };
        product.Weight.Should().Be(PackageWeight.SixtyTwoKilos);
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ProductWeightCalculatorTests"
```

Expected: **build error** — `ProductWeightCalculator` does not exist.

- [ ] **Step 3: Extract the calculator**

`api/AleTrack/AleTrack/Features/Products/Utils/ProductWeightCalculator.cs`:

```csharp
using AleTrack.Common.Enums;

namespace AleTrack.Features.Products.Utils;

/// <summary>
/// Net weight in kilograms of one packaged unit, derived from its kind and package size.
/// The single source of truth: <see cref="Entities.Product.Weight"/> delegates here, and the
/// reporting handlers call it directly because <c>Product.Weight</c> is an unmapped computed
/// property that EF Core cannot translate to SQL.
/// </summary>
public static class ProductWeightCalculator
{
    public static double? Compute(ProductKind kind, double? packageSize)
    {
        if (packageSize == null)
            return null;

        return kind switch
        {
            ProductKind.Bottle when packageSize == BottleSize.OneLiter => PackageWeight.OneKilo,
            ProductKind.Bottle when packageSize == BottleSize.TwoLiters => PackageWeight.TwoKilos,
            ProductKind.Bottle when packageSize == BottleSize.TenLiters => PackageWeight.TwentyKilos,
            ProductKind.Keg when packageSize == KegSize.FiveLiters => PackageWeight.FiveKilos,
            ProductKind.Keg when packageSize == KegSize.FifteenLiters => PackageWeight.TwentyKilos,
            ProductKind.Keg when packageSize == KegSize.TwentyLiters => PackageWeight.TwentyKilos,
            ProductKind.Keg when packageSize == KegSize.ThirtyLiters => PackageWeight.FortyTwoKilos,
            ProductKind.Keg when packageSize == KegSize.FiftyLiters => PackageWeight.SixtyTwoKilos,
            ProductKind.Can when packageSize == CanSize.ZeroPointThreeThreeLiters => PackageWeight.ZeroPointThree,
            ProductKind.Can when packageSize == CanSize.ZeroPointFiveLiters => PackageWeight.ZeroPointFive,
            ProductKind.Can when packageSize == CanSize.TwoLiters => PackageWeight.TwoKilos,
            _ => null
        };
    }
}
```

Then replace the body of `Product.Weight` (`Entities/Product.cs`) — keep the property,
drop the duplicated switch:

```csharp
    /// <summary>
    /// Weight of the product in kilograms
    /// </summary>
    public double? Weight => ProductWeightCalculator.Compute(Kind, PackageSize);
```

- [ ] **Step 4: Run it and watch it pass**

```bash
cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ProductWeightCalculatorTests"
```

Expected: PASS, 6 tests. Then run the **whole** suite — `Product.Weight` has existing
callers: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj` → expected 131 passed + 6 new = 137.

- [ ] **Step 5: Commit**

```bash
git add api/AleTrack/AleTrack/Features/Products/Utils/ProductWeightCalculator.cs \
        api/AleTrack/AleTrack/Entities/Product.cs \
        api/AleTrack/AleTrack.Tests/Features/Reports/DeliveryVolumeReportTests.cs
git commit -m "refactor(products): extract unit weight into a reusable calculator"
```

- [ ] **Step 6: Write the shared window/bucketing helpers**

`api/AleTrack/AleTrack/Features/Reports/Utils/ReportWindow.cs`:

```csharp
namespace AleTrack.Features.Reports.Utils;

/// <summary>Bucket width for a report's time series.</summary>
public enum ReportGranularity
{
    Day,
    Week,
    Month
}

/// <summary>Common inclusive date window shared by every report request.</summary>
public abstract record ReportWindowRequest
{
    /// <summary>First day included in the report (inclusive).</summary>
    public DateOnly From { get; set; }

    /// <summary>Last day included in the report (inclusive).</summary>
    public DateOnly To { get; set; }
}

/// <summary>One day's totals, before roll-up.</summary>
public readonly record struct DailyBucket(DateOnly Date, decimal WeightKg, int Units);

/// <summary>One point of a report time series. Shared by every report that has a trend.</summary>
public sealed record ReportSeriesPointDto
{
    /// <summary>First day of the bucket — the day itself, its ISO Monday, or the 1st of the month.</summary>
    public DateOnly BucketStart { get; set; }

    /// <summary>Total delivered weight in the bucket, kilograms.</summary>
    public decimal WeightKg { get; set; }

    /// <summary>Total delivered units in the bucket.</summary>
    public int Units { get; set; }
}

/// <summary>
/// Rolls daily totals up into day / week / month buckets in memory. Deliberately not done in
/// SQL: week truncation is provider-specific and the windows involved are small.
/// </summary>
public static class ReportBucketing
{
    public static List<ReportSeriesPointDto> RollUp(IEnumerable<DailyBucket> daily, ReportGranularity granularity)
    {
        return daily
            .GroupBy(d => BucketStart(d.Date, granularity))
            .OrderBy(g => g.Key)
            .Select(g => new ReportSeriesPointDto
            {
                BucketStart = g.Key,
                WeightKg = g.Sum(x => x.WeightKg),
                Units = g.Sum(x => x.Units)
            })
            .ToList();
    }

    /// <summary>Monday of the ISO week for <see cref="ReportGranularity.Week"/>; the 1st for Month.</summary>
    public static DateOnly BucketStart(DateOnly date, ReportGranularity granularity)
    {
        return granularity switch
        {
            ReportGranularity.Day => date,
            ReportGranularity.Week => date.AddDays(-(((int)date.DayOfWeek + 6) % 7)),
            ReportGranularity.Month => new DateOnly(date.Year, date.Month, 1),
            _ => throw new ArgumentOutOfRangeException(nameof(granularity))
        };
    }
}
```

- [ ] **Step 7: Write the failing bucketing test**

Append to `DeliveryVolumeReportTests.cs`:

```csharp
public sealed class ReportBucketingTests
{
    [Fact]
    public void BucketStart_Week_SnapsToMonday()
    {
        // 2026-07-25 is a Saturday; its ISO week starts Monday 2026-07-20.
        ReportBucketing.BucketStart(new DateOnly(2026, 7, 25), ReportGranularity.Week)
            .Should().Be(new DateOnly(2026, 7, 20));
        ReportBucketing.BucketStart(new DateOnly(2026, 7, 20), ReportGranularity.Week)
            .Should().Be(new DateOnly(2026, 7, 20));
        // Sunday belongs to the week that started the previous Monday.
        ReportBucketing.BucketStart(new DateOnly(2026, 7, 26), ReportGranularity.Week)
            .Should().Be(new DateOnly(2026, 7, 20));
    }

    [Fact]
    public void RollUp_Month_SumsDaysIntoOnePointPerMonth()
    {
        var daily = new[]
        {
            new DailyBucket(new DateOnly(2026, 6, 30), 10m, 1),
            new DailyBucket(new DateOnly(2026, 7, 1), 5m, 2),
            new DailyBucket(new DateOnly(2026, 7, 31), 7m, 3)
        };

        var points = ReportBucketing.RollUp(daily, ReportGranularity.Month);

        points.Should().HaveCount(2);
        points[0].BucketStart.Should().Be(new DateOnly(2026, 6, 1));
        points[0].WeightKg.Should().Be(10m);
        points[1].BucketStart.Should().Be(new DateOnly(2026, 7, 1));
        points[1].WeightKg.Should().Be(12m);
        points[1].Units.Should().Be(5);
    }

    [Fact]
    public void RollUp_ReturnsEmpty_ForNoRows()
    {
        ReportBucketing.RollUp([], ReportGranularity.Week).Should().BeEmpty();
    }
}
```

Run `--filter "FullyQualifiedName~ReportBucketingTests"`: fails to build until Step 8's
DTO exists, then passes.

- [ ] **Step 8: Write the shared delivered-line projection**

`api/AleTrack/AleTrack/Features/Reports/Utils/DeliveredLineRow.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Infrastructure.Persistence;

namespace AleTrack.Features.Reports.Utils;

/// <summary>
/// One delivered order line, flattened. <see cref="PackageSize"/> travels instead of a weight
/// because <c>Product.Weight</c> is an unmapped computed property — see <see cref="WeightKg"/>.
/// </summary>
public sealed record DeliveredLineRow
{
    /// <summary>
    /// The shipment's delivery timestamp, straight out of the `timestamptz` column. The day is
    /// derived in memory (<see cref="Date"/>) because casting a mapped column to a date inside
    /// the query is either untranslatable or session-timezone dependent.
    /// </summary>
    public DateTime DeliveredAtUtc { get; init; }

    /// <summary>Delivery day, derived client-side from <see cref="DeliveredAtUtc"/>.</summary>
    public DateOnly Date => DateOnly.FromDateTime(DeliveredAtUtc);
    public long ClientId { get; init; }
    public string ClientName { get; init; } = null!;
    public Region ClientRegion { get; init; }
    public long BreweryId { get; init; }
    public Guid BreweryPublicId { get; init; }
    public string BreweryName { get; init; } = null!;
    public string? BreweryColor { get; init; }
    public long StopId { get; init; }
    public ProductKind Kind { get; init; }
    public ProductType Type { get; init; }
    public int Quantity { get; init; }
    public double? PackageSize { get; init; }

    /// <summary>Line weight in kg, or 0 when the product has no derivable unit weight.</summary>
    public decimal WeightKg =>
        (decimal)((ProductWeightCalculator.Compute(Kind, PackageSize) ?? 0d) * Quantity);
}

/// <summary>
/// The one query every volume report starts from: order lines that actually reached the client.
/// </summary>
public static class DeliveredLineQuery
{
    /// <summary>
    /// Order lines on delivered shipments whose delivery date falls inside the window.
    /// Only <see cref="OutgoingShipmentStopKind.Order"/> stops carry products; custom stops and
    /// client/custom extra items are excluded from v1 volume by design (see the module spec).
    /// Projects raw columns only — never touch <c>Product.Weight</c> here, EF cannot translate it.
    /// </summary>
    public static IQueryable<DeliveredLineRow> Project(AleTrackDbContext dbContext, DateOnly from, DateOnly to)
    {
        // Kind=Utc is mandatory: DeliveryDate is timestamptz and Npgsql rejects Unspecified.
        var fromDate = from.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var toDate = to.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

        return dbContext.OrderItems
            .Where(oi => oi.Order.OutgoingShipmentStop != null
                         && oi.Order.OutgoingShipmentStop.Kind == OutgoingShipmentStopKind.Order
                         && oi.Order.OutgoingShipmentStop.OutgoingShipment.State == OutgoingShipmentState.Delivered
                         && oi.Order.OutgoingShipmentStop.OutgoingShipment.DeliveryDate != null
                         && oi.Order.OutgoingShipmentStop.OutgoingShipment.DeliveryDate >= fromDate
                         && oi.Order.OutgoingShipmentStop.OutgoingShipment.DeliveryDate <= toDate)
            .Select(oi => new DeliveredLineRow
            {
                DeliveredAtUtc = oi.Order.OutgoingShipmentStop!.OutgoingShipment.DeliveryDate!.Value,
                ClientId = oi.Order.ClientId,
                ClientName = oi.Order.Client.Name,
                ClientRegion = oi.Order.Client.Region,
                BreweryId = oi.Product.BreweryId,
                BreweryPublicId = oi.Product.Brewery.PublicId,
                BreweryName = oi.Product.Brewery.Name,
                BreweryColor = oi.Product.Brewery.Color,
                StopId = oi.Order.OutgoingShipmentStop.Id,
                Kind = oi.Product.Kind,
                Type = oi.Product.Type,
                Quantity = oi.Quantity,
                PackageSize = oi.Product.PackageSize
            });
    }
}
```

- [ ] **Step 9: Write the volume DTO**

`api/AleTrack/AleTrack/Features/Reports/Queries/DeliveryVolume/DeliveryVolumeReportDto.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Features.Reports.Utils;

namespace AleTrack.Features.Reports.Queries.DeliveryVolume;

/// <summary>Delivered volume over a window — totals, breakdowns and a trend series.</summary>
public sealed record DeliveryVolumeReportDto
{
    public decimal TotalWeightKg { get; set; }
    public int TotalUnits { get; set; }

    /// <summary>Distinct clients that received at least one line in the window.</summary>
    public int ClientsServed { get; set; }

    public List<VolumeByKindDto> UnitsByKind { get; set; } = [];
    public List<VolumeByBreweryDto> ByBrewery { get; set; } = [];
    public List<VolumeByTypeDto> ByType { get; set; } = [];
    public List<ReportSeriesPointDto> Series { get; set; } = [];
}

public sealed record VolumeByKindDto
{
    public ProductKind Kind { get; set; }
    public int Units { get; set; }
    public decimal WeightKg { get; set; }
}

public sealed record VolumeByBreweryDto
{
    public Guid BreweryId { get; set; }
    public string BreweryName { get; set; } = null!;

    /// <summary>The brewery's own display colour, so charts key off the entity, not its rank.</summary>
    public string? Color { get; set; }

    public int Units { get; set; }
    public decimal WeightKg { get; set; }
}

public sealed record VolumeByTypeDto
{
    public ProductType Type { get; set; }
    public int Units { get; set; }
    public decimal WeightKg { get; set; }
}
```

- [ ] **Step 10: Write the failing endpoint test**

Append to `DeliveryVolumeReportTests.cs`. `DeliveredShipmentBuilder` is written in Step 11.

```csharp
public sealed class GetDeliveryVolumeEndpointTests
{
    [Fact]
    public async Task HandleAsync_AggregatesDeliveredLines_ByKindBreweryTypeAndSeries()
    {
        // Arrange — one delivered shipment with two lines from one brewery.
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20),
            state: OutgoingShipmentState.Delivered,
            lines:
            [
                new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 2),
                new(ProductKind.Can, ProductType.Radler, CanSize.ZeroPointFiveLiters, quantity: 10)
            ]);

        var endpoint = EndpointWithResponseBuilder<GetDeliveryVolumeRequest,
            DeliveryVolumeReportDto, GetDeliveryVolumeEndpoint>.Create(fixture.DbContext.Object);

        // Act
        await endpoint.HandleAsync(new GetDeliveryVolumeRequest
        {
            From = new DateOnly(2026, 7, 1),
            To = new DateOnly(2026, 7, 31),
            Granularity = ReportGranularity.Week
        }, CancellationToken.None);

        // Assert
        var response = endpoint.Response;
        response.Should().NotBeNull();

        // 2 kegs x 62 kg + 10 cans x 0.5 kg = 129 kg
        response.TotalWeightKg.Should().Be(129m);
        response.TotalUnits.Should().Be(12);
        response.ClientsServed.Should().Be(1);

        response.UnitsByKind.Should().HaveCount(2);
        response.UnitsByKind.Single(k => k.Kind == ProductKind.Keg).WeightKg.Should().Be(124m);
        response.UnitsByKind.Single(k => k.Kind == ProductKind.Can).Units.Should().Be(10);

        response.ByBrewery.Should().HaveCount(1);
        response.ByBrewery[0].WeightKg.Should().Be(129m);
        response.ByBrewery[0].Color.Should().Be(fixture.Brewery.Color);

        response.ByType.Should().HaveCount(2);
        response.ByType.Single(t => t.Type == ProductType.PaleLager).WeightKg.Should().Be(124m);

        // 2026-07-20 is a Monday, so the week bucket starts on it.
        response.Series.Should().HaveCount(1);
        response.Series[0].BucketStart.Should().Be(new DateOnly(2026, 7, 20));
        response.Series[0].WeightKg.Should().Be(129m);
    }

    [Fact]
    public async Task HandleAsync_ExcludesShipmentsThatAreNotDelivered()
    {
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20),
            state: OutgoingShipmentState.InTransit,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 2)]);

        var endpoint = EndpointWithResponseBuilder<GetDeliveryVolumeRequest,
            DeliveryVolumeReportDto, GetDeliveryVolumeEndpoint>.Create(fixture.DbContext.Object);

        await endpoint.HandleAsync(new GetDeliveryVolumeRequest
        {
            From = new DateOnly(2026, 7, 1),
            To = new DateOnly(2026, 7, 31),
            Granularity = ReportGranularity.Week
        }, CancellationToken.None);

        endpoint.Response.TotalWeightKg.Should().Be(0m);
        endpoint.Response.TotalUnits.Should().Be(0);
        endpoint.Response.Series.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleAsync_ExcludesShipmentsOutsideTheWindow()
    {
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 6, 30),
            state: OutgoingShipmentState.Delivered,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 2)]);

        var endpoint = EndpointWithResponseBuilder<GetDeliveryVolumeRequest,
            DeliveryVolumeReportDto, GetDeliveryVolumeEndpoint>.Create(fixture.DbContext.Object);

        await endpoint.HandleAsync(new GetDeliveryVolumeRequest
        {
            From = new DateOnly(2026, 7, 1),
            To = new DateOnly(2026, 7, 31),
            Granularity = ReportGranularity.Week
        }, CancellationToken.None);

        endpoint.Response.TotalWeightKg.Should().Be(0m);
    }

    [Fact]
    public async Task HandleAsync_IncludesADeliveryLateOnTheClosingDay()
    {
        // The window's To is inclusive to end-of-day. Regressing TimeOnly.MaxValue to
        // MinValue would silently drop everything delivered after midnight on the To date.
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 31, 18, 30, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Delivered,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 1)]);

        var endpoint = EndpointWithResponseBuilder<GetDeliveryVolumeRequest,
            DeliveryVolumeReportDto, GetDeliveryVolumeEndpoint>.Create(fixture.DbContext.Object);

        await endpoint.HandleAsync(new GetDeliveryVolumeRequest
        {
            From = new DateOnly(2026, 7, 1),
            To = new DateOnly(2026, 7, 31),
            Granularity = ReportGranularity.Week
        }, CancellationToken.None);

        endpoint.Response.TotalWeightKg.Should().Be(62m);
    }

    [Fact]
    public async Task HandleAsync_IncludesADeliveryAtMidnightOnTheOpeningDay()
    {
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Delivered,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 1)]);

        var endpoint = EndpointWithResponseBuilder<GetDeliveryVolumeRequest,
            DeliveryVolumeReportDto, GetDeliveryVolumeEndpoint>.Create(fixture.DbContext.Object);

        await endpoint.HandleAsync(new GetDeliveryVolumeRequest
        {
            From = new DateOnly(2026, 7, 1),
            To = new DateOnly(2026, 7, 31),
            Granularity = ReportGranularity.Week
        }, CancellationToken.None);

        endpoint.Response.TotalWeightKg.Should().Be(62m);
    }

    [Fact]
    public async Task HandleAsync_CountsProductWithoutDerivableWeight_AsUnitsOnly()
    {
        // Multipack has no weight mapping — it must still count as units, at 0 kg.
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20),
            state: OutgoingShipmentState.Delivered,
            lines: [new(ProductKind.Multipack, ProductType.Mix, packageSize: 6, quantity: 4)]);

        var endpoint = EndpointWithResponseBuilder<GetDeliveryVolumeRequest,
            DeliveryVolumeReportDto, GetDeliveryVolumeEndpoint>.Create(fixture.DbContext.Object);

        await endpoint.HandleAsync(new GetDeliveryVolumeRequest
        {
            From = new DateOnly(2026, 7, 1),
            To = new DateOnly(2026, 7, 31),
            Granularity = ReportGranularity.Week
        }, CancellationToken.None);

        endpoint.Response.TotalUnits.Should().Be(4);
        endpoint.Response.TotalWeightKg.Should().Be(0m);
    }

    [Fact]
    public async Task HandleAsync_ReturnsZeroedDto_ForEmptyWindow()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var endpoint = EndpointWithResponseBuilder<GetDeliveryVolumeRequest,
            DeliveryVolumeReportDto, GetDeliveryVolumeEndpoint>.Create(dbContext.Object);

        await endpoint.HandleAsync(new GetDeliveryVolumeRequest
        {
            From = new DateOnly(2026, 7, 1),
            To = new DateOnly(2026, 7, 31),
            Granularity = ReportGranularity.Month
        }, CancellationToken.None);

        var response = endpoint.Response;
        response.TotalWeightKg.Should().Be(0m);
        response.TotalUnits.Should().Be(0);
        response.ClientsServed.Should().Be(0);
        response.UnitsByKind.Should().BeEmpty();
        response.ByBrewery.Should().BeEmpty();
        response.ByType.Should().BeEmpty();
        response.Series.Should().BeEmpty();
    }
}
```

Add these `using`s at the top of the test file:

```csharp
using AleTrack.Entities;
using AleTrack.Features.Products.Utils;
using AleTrack.Features.Reports.Queries.DeliveryVolume;
using AleTrack.Features.Reports.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
```

- [ ] **Step 11: Write the fixture builder**

`api/AleTrack/AleTrack.Tests/Builders/DeliveredShipmentBuilder.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using AleTrack.Tests.Mocks;
using Moq;

namespace AleTrack.Tests.Builders;

/// <summary>One delivered order line to seed into the fixture.</summary>
public sealed record LineSpec(ProductKind Kind, ProductType Type, double? PackageSize, int Quantity)
{
    public LineSpec(ProductKind kind, ProductType type, double packageSize, int quantity)
        : this(kind, type, (double?)packageSize, quantity) { }
}

/// <summary>The whole object graph a report test needs, plus the mocked DbContext over it.</summary>
public sealed record DeliveredShipmentFixture(
    Mock<AleTrackDbContext> DbContext,
    OutgoingShipment Shipment,
    Order Order,
    Client Client,
    Brewery Brewery,
    Driver Driver,
    List<OrderItem> OrderItems);

/// <summary>
/// Builds a single-client, single-brewery delivered shipment wired end to end
/// (shipment → order stop → order → items → products) so report handlers can traverse it.
/// </summary>
public static class DeliveredShipmentBuilder
{
    public static DeliveredShipmentFixture Build(
        DateTime deliveryDate,
        OutgoingShipmentState state,
        List<LineSpec> lines,
        Region region = Region.ZittauCity,
        OrderState orderState = OrderState.Finished,
        DateOnly? requiredDeliveryDate = null,
        DateOnly? actualDeliveryDate = null,
        List<OutgoingShipmentReturn>? returns = null)
    {
        var brewery = BreweryBuilder.BuildEntity(name: "Pivovar Zittau", color: "#E69F00");
        brewery.Id = 1;

        var client = ClientBuilder.BuildEntity(name: "Hospoda U Kotvy", region: region);
        client.Id = 1;

        var driver = DriverBuilder.BuildEntity(firstName: "Jan", lastName: "Novák", color: "#0072B2");
        driver.Id = 1;

        var products = new List<Product>();
        var orderItems = new List<OrderItem>();

        var order = new Order
        {
            Id = 1,
            PublicId = Guid.NewGuid(),
            Client = client,
            ClientId = client.Id,
            State = orderState,
            CreatedDate = deliveryDate.AddDays(-7),
            RequiredDeliveryDate = requiredDeliveryDate,
            ActualDeliveryDate = actualDeliveryDate
        };

        var shipment = OutgoingShipmentBuilder.BuildEntity(deliveryDate: deliveryDate, state: state);
        shipment.Id = 1;
        shipment.Returns = returns ?? [];
        shipment.Drivers = [new OutgoingShipmentDriver { DriverId = driver.Id, Driver = driver, OutgoingShipmentId = shipment.Id, OutgoingShipment = shipment }];

        var stop = new OutgoingShipmentStop
        {
            Id = 1,
            PublicId = Guid.NewGuid(),
            Kind = OutgoingShipmentStopKind.Order,
            Order = 1,
            OutgoingShipmentId = shipment.Id,
            OutgoingShipment = shipment,
            ClientOrderId = order.Id,
            ClientOrder = order
        };

        shipment.Stops = [stop];
        order.OutgoingShipmentStop = stop;
        order.OutgoingShipmentStopId = stop.Id;

        var nextId = 1L;
        foreach (var line in lines)
        {
            var product = ProductBuilder.BuildEntity(
                name: $"Produkt {nextId}",
                kind: line.Kind,
                type: line.Type,
                packageSize: line.PackageSize);
            product.Id = nextId;
            product.BreweryId = brewery.Id;
            product.Brewery = brewery;
            products.Add(product);

            orderItems.Add(new OrderItem
            {
                Id = nextId,
                PublicId = Guid.NewGuid(),
                OrderId = order.Id,
                Order = order,
                ProductId = product.Id,
                Product = product,
                Quantity = line.Quantity
            });

            nextId++;
        }

        order.OrderItems = orderItems;

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client],
            breweries: [brewery],
            products: products,
            orders: [order],
            orderItems: orderItems,
            drivers: [driver],
            outgoingShipments: [shipment]);

        return new DeliveredShipmentFixture(dbContext, shipment, order, client, brewery, driver, orderItems);
    }
}
```

- [ ] **Step 12: Run the tests and watch them fail**

```bash
cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~GetDeliveryVolumeEndpointTests"
```

Expected: **build error** — `GetDeliveryVolumeEndpoint` / `GetDeliveryVolumeRequest` do not exist.

- [ ] **Step 13: Write the endpoint**

`api/AleTrack/AleTrack/Features/Reports/Queries/DeliveryVolume/GetDeliveryVolumeEndpoint.cs`:

```csharp
using AleTrack.Features.Reports.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Reports.Queries.DeliveryVolume;

/// <summary>Request for the delivered-volume report over an inclusive date window.</summary>
public sealed record GetDeliveryVolumeRequest : ReportWindowRequest
{
    /// <summary>Bucket width of the returned trend series. Defaults to weekly.</summary>
    public ReportGranularity Granularity { get; set; } = ReportGranularity.Week;
}

/// <summary>
/// Delivered volume for the Objem tab: totals, per-kind / per-brewery / per-type breakdowns
/// and a trend series.
/// </summary>
/// <remarks>
/// Aggregation happens in memory on purpose: the per-unit weight comes from
/// <see cref="Features.Products.Utils.ProductWeightCalculator"/>, mirroring the unmapped
/// <c>Product.Weight</c> property, so it cannot be summed in SQL. Only the row projection runs
/// on the server; the windows involved are small enough for this to be cheap.
/// </remarks>
public sealed class GetDeliveryVolumeEndpoint(AleTrackDbContext dbContext)
    : Endpoint<GetDeliveryVolumeRequest, DeliveryVolumeReportDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("reports/delivery-volume");
        Description(b => b
            .RequireAuthenticated()
            .WithName(nameof(GetDeliveryVolumeEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets delivered volume aggregated over a date window";
            s.Responses[StatusCodes.Status200OK] = "Delivered volume totals, breakdowns and trend series";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetDeliveryVolumeRequest req, CancellationToken ct)
    {
        var rows = await DeliveredLineQuery.Project(dbContext, req.From, req.To).ToListAsync(ct);

        var result = new DeliveryVolumeReportDto
        {
            TotalWeightKg = rows.Sum(r => r.WeightKg),
            TotalUnits = rows.Sum(r => r.Quantity),
            ClientsServed = rows.Select(r => r.ClientId).Distinct().Count(),

            UnitsByKind = rows
                .GroupBy(r => r.Kind)
                .Select(g => new VolumeByKindDto
                {
                    Kind = g.Key,
                    Units = g.Sum(r => r.Quantity),
                    WeightKg = g.Sum(r => r.WeightKg)
                })
                .OrderBy(k => k.Kind)
                .ToList(),

            ByBrewery = rows
                .GroupBy(r => new { r.BreweryPublicId, r.BreweryName, r.BreweryColor })
                .Select(g => new VolumeByBreweryDto
                {
                    BreweryId = g.Key.BreweryPublicId,
                    BreweryName = g.Key.BreweryName,
                    Color = g.Key.BreweryColor,
                    Units = g.Sum(r => r.Quantity),
                    WeightKg = g.Sum(r => r.WeightKg)
                })
                .OrderByDescending(b => b.WeightKg)
                .ToList(),

            ByType = rows
                .GroupBy(r => r.Type)
                .Select(g => new VolumeByTypeDto
                {
                    Type = g.Key,
                    Units = g.Sum(r => r.Quantity),
                    WeightKg = g.Sum(r => r.WeightKg)
                })
                .OrderByDescending(t => t.WeightKg)
                .ToList(),

            Series = ReportBucketing.RollUp(
                rows.GroupBy(r => r.Date)
                    .Select(g => new DailyBucket(g.Key, g.Sum(r => r.WeightKg), g.Sum(r => r.Quantity))),
                req.Granularity)
        };

        await Send.OkAsync(result, ct);
    }
}
```

- [ ] **Step 14: Run the tests and watch them pass**

```bash
cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~Reports"
```

Expected: PASS — 6 calculator + 3 bucketing + 5 endpoint = 14 tests.
Then the full suite: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj` → 145 passed.

- [ ] **Step 15: Commit**

```bash
git add api/AleTrack/AleTrack/Features/Reports api/AleTrack/AleTrack.Tests/Features/Reports \
        api/AleTrack/AleTrack.Tests/Builders/DeliveredShipmentBuilder.cs
git commit -m "feat(reports): delivered-volume aggregation endpoint

Weight is summed in memory because Product.Weight is an unmapped computed
property EF Core cannot translate. Adds ClientsServed to the DTO, which the
spec omitted but the prototype's first KPI needs."
```

---

## Task 2: Client-volume endpoint (Klienti)

**Files:**
- Create: `api/AleTrack/AleTrack/Features/Reports/Queries/ClientVolume/ClientVolumeReportDto.cs`
- Create: `api/AleTrack/AleTrack/Features/Reports/Queries/ClientVolume/GetClientVolumeEndpoint.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/Reports/ClientVolumeReportTests.cs`

**Interfaces:**
- Consumes from Task 1: `DeliveredLineQuery.Project(dbContext, from, to)`,
  `DeliveredLineRow` (fields `ClientId`, `ClientName`, `ClientRegion`, `StopId`,
  `Quantity`, `WeightKg`), `ReportWindowRequest`, `DeliveredShipmentBuilder.Build(...)`
  returning `DeliveredShipmentFixture`, `LineSpec(kind, type, packageSize, quantity)`.
- Produces:
  - `ClientVolumeReportDto { int ClientsServed; int TotalDeliveries; decimal TotalWeightKg; List<ClientVolumeRowDto> TopClients; List<VolumeByRegionDto> ByRegion; }`
  - `ClientVolumeRowDto { Guid ClientId; string ClientName; Region Region; int Deliveries; int Units; decimal WeightKg; }`
  - `VolumeByRegionDto { Region Region; int Units; decimal WeightKg; }`
  - Route: `GET reports/client-volume?From=&To=`

**Definition note:** `Deliveries` is the count of **distinct shipment stops** for that
client in the window (one stop = one drop-off), which is what the prototype's
"Rozvozů" column counts (line 921, `new Set(rr.map(r=>r.date)).size` — the prototype
approximates it by date because it has no stop concept). `TotalDeliveries` is the sum
across clients. Record this in the commit message.

`ClientVolumeRowDto.ClientId` must be the client's **`PublicId`**, because the
Klienti table rows navigate to `/clients/:id` and the frontend routes on public ids.
This requires adding `ClientPublicId` to `DeliveredLineRow` and its projection.

- [ ] **Step 1: Extend the shared row with the client's public id**

In `Features/Reports/Utils/DeliveredLineRow.cs`, add to the record:

```csharp
    public Guid ClientPublicId { get; init; }
```

and to `DeliveredLineQuery.Project`'s `Select`, after `ClientId = oi.Order.ClientId,`:

```csharp
                ClientPublicId = oi.Order.Client.PublicId,
```

- [ ] **Step 2: Write the failing test**

`api/AleTrack/AleTrack.Tests/Features/Reports/ClientVolumeReportTests.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Features.Products.Utils;
using AleTrack.Features.Reports.Queries.ClientVolume;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.Reports;

public sealed class GetClientVolumeEndpointTests
{
    private static GetClientVolumeRequest Window() => new()
    {
        From = new DateOnly(2026, 7, 1),
        To = new DateOnly(2026, 7, 31)
    };

    [Fact]
    public async Task HandleAsync_AggregatesPerClientAndRegion()
    {
        // Arrange — one client in ZittauCity, two lines on one delivered stop.
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20),
            state: OutgoingShipmentState.Delivered,
            region: Region.ZittauCity,
            lines:
            [
                new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 2),
                new(ProductKind.Can, ProductType.Radler, CanSize.ZeroPointFiveLiters, quantity: 10)
            ]);

        var endpoint = EndpointWithResponseBuilder<GetClientVolumeRequest,
            ClientVolumeReportDto, GetClientVolumeEndpoint>.Create(fixture.DbContext.Object);

        // Act
        await endpoint.HandleAsync(Window(), CancellationToken.None);

        // Assert
        var response = endpoint.Response;
        response.Should().NotBeNull();
        response.ClientsServed.Should().Be(1);
        response.TotalWeightKg.Should().Be(129m);

        // Two lines on ONE stop is one delivery, not two.
        response.TotalDeliveries.Should().Be(1);

        response.TopClients.Should().HaveCount(1);
        var row = response.TopClients[0];
        row.ClientId.Should().Be(fixture.Client.PublicId);
        row.ClientName.Should().Be("Hospoda U Kotvy");
        row.Region.Should().Be(Region.ZittauCity);
        row.Deliveries.Should().Be(1);
        row.Units.Should().Be(12);
        row.WeightKg.Should().Be(129m);

        response.ByRegion.Should().HaveCount(1);
        response.ByRegion[0].Region.Should().Be(Region.ZittauCity);
        response.ByRegion[0].WeightKg.Should().Be(129m);
    }

    [Fact]
    public async Task HandleAsync_OrdersTopClientsByWeightDescending()
    {
        // Arrange — two clients, the second heavier, both on delivered stops.
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20),
            state: OutgoingShipmentState.Delivered,
            lines: [new(ProductKind.Can, ProductType.Radler, CanSize.ZeroPointFiveLiters, quantity: 10)]);

        var heavier = DeliveredShipmentBuilder.AddSecondClient(
            fixture,
            clientName: "Restaurace Na Rynku",
            region: Region.Leipzig,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 3)]);

        var endpoint = EndpointWithResponseBuilder<GetClientVolumeRequest,
            ClientVolumeReportDto, GetClientVolumeEndpoint>.Create(heavier.DbContext.Object);

        // Act
        await endpoint.HandleAsync(Window(), CancellationToken.None);

        // Assert
        var response = endpoint.Response;
        response.ClientsServed.Should().Be(2);
        response.TotalDeliveries.Should().Be(2);
        response.TopClients.Should().HaveCount(2);
        response.TopClients[0].ClientName.Should().Be("Restaurace Na Rynku"); // 186 kg
        response.TopClients[0].WeightKg.Should().Be(186m);
        response.TopClients[1].WeightKg.Should().Be(5m);
        response.ByRegion.Should().HaveCount(2);
        response.ByRegion[0].Region.Should().Be(Region.Leipzig); // ordered by weight desc
    }

    [Fact]
    public async Task HandleAsync_ExcludesShipmentsThatAreNotDelivered()
    {
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20),
            state: OutgoingShipmentState.Cancelled,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 2)]);

        var endpoint = EndpointWithResponseBuilder<GetClientVolumeRequest,
            ClientVolumeReportDto, GetClientVolumeEndpoint>.Create(fixture.DbContext.Object);

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        endpoint.Response.ClientsServed.Should().Be(0);
        endpoint.Response.TopClients.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleAsync_ReturnsZeroedDto_ForEmptyWindow()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var endpoint = EndpointWithResponseBuilder<GetClientVolumeRequest,
            ClientVolumeReportDto, GetClientVolumeEndpoint>.Create(dbContext.Object);

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        var response = endpoint.Response;
        response.ClientsServed.Should().Be(0);
        response.TotalDeliveries.Should().Be(0);
        response.TotalWeightKg.Should().Be(0m);
        response.TopClients.Should().BeEmpty();
        response.ByRegion.Should().BeEmpty();
    }
}
```

- [ ] **Step 3: Add the second-client helper to the fixture builder**

Append to `api/AleTrack/AleTrack.Tests/Builders/DeliveredShipmentBuilder.cs`, inside
`DeliveredShipmentBuilder`:

```csharp
    /// <summary>
    /// Adds a second client with its own order and stop on the SAME delivered shipment, and
    /// returns a fixture whose mocked DbContext sees both. Used to assert ordering and grouping.
    /// </summary>
    public static DeliveredShipmentFixture AddSecondClient(
        DeliveredShipmentFixture fixture,
        string clientName,
        Region region,
        List<LineSpec> lines)
    {
        var client = ClientBuilder.BuildEntity(name: clientName, region: region);
        client.Id = 2;

        var order = new Order
        {
            Id = 2,
            PublicId = Guid.NewGuid(),
            Client = client,
            ClientId = client.Id,
            State = OrderState.Finished,
            CreatedDate = fixture.Shipment.DeliveryDate!.Value.AddDays(-7)
        };

        var stop = new OutgoingShipmentStop
        {
            Id = 2,
            PublicId = Guid.NewGuid(),
            Kind = OutgoingShipmentStopKind.Order,
            Order = 2,
            OutgoingShipmentId = fixture.Shipment.Id,
            OutgoingShipment = fixture.Shipment,
            ClientOrderId = order.Id,
            ClientOrder = order
        };

        order.OutgoingShipmentStop = stop;
        order.OutgoingShipmentStopId = stop.Id;
        fixture.Shipment.Stops.Add(stop);

        var products = new List<Product>();
        var orderItems = new List<OrderItem>();
        var nextId = 100L;

        foreach (var line in lines)
        {
            var product = ProductBuilder.BuildEntity(
                name: $"Produkt {nextId}",
                kind: line.Kind,
                type: line.Type,
                packageSize: line.PackageSize);
            product.Id = nextId;
            product.BreweryId = fixture.Brewery.Id;
            product.Brewery = fixture.Brewery;
            products.Add(product);

            orderItems.Add(new OrderItem
            {
                Id = nextId,
                PublicId = Guid.NewGuid(),
                OrderId = order.Id,
                Order = order,
                ProductId = product.Id,
                Product = product,
                Quantity = line.Quantity
            });

            nextId++;
        }

        order.OrderItems = orderItems;

        var allProducts = fixture.OrderItems.Select(oi => oi.Product).Concat(products).ToList();
        var allOrderItems = fixture.OrderItems.Concat(orderItems).ToList();

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [fixture.Client, client],
            breweries: [fixture.Brewery],
            products: allProducts,
            orders: [fixture.Order, order],
            orderItems: allOrderItems,
            drivers: [fixture.Driver],
            outgoingShipments: [fixture.Shipment]);

        return fixture with { DbContext = dbContext, OrderItems = allOrderItems };
    }
```

- [ ] **Step 4: Run the tests and watch them fail**

```bash
cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~GetClientVolumeEndpointTests"
```

Expected: **build error** — `GetClientVolumeEndpoint` / `ClientVolumeReportDto` do not exist.

- [ ] **Step 5: Write the DTO**

`api/AleTrack/AleTrack/Features/Reports/Queries/ClientVolume/ClientVolumeReportDto.cs`:

```csharp
using AleTrack.Common.Enums;

namespace AleTrack.Features.Reports.Queries.ClientVolume;

/// <summary>Who took delivery over a window, how often and how much.</summary>
public sealed record ClientVolumeReportDto
{
    /// <summary>Distinct clients with at least one delivered line.</summary>
    public int ClientsServed { get; set; }

    /// <summary>Distinct delivered shipment stops across all clients — one stop is one drop-off.</summary>
    public int TotalDeliveries { get; set; }

    public decimal TotalWeightKg { get; set; }

    /// <summary>Every client with volume, heaviest first. The frontend slices the top 10 for its chart.</summary>
    public List<ClientVolumeRowDto> TopClients { get; set; } = [];

    public List<VolumeByRegionDto> ByRegion { get; set; } = [];
}

public sealed record ClientVolumeRowDto
{
    /// <summary>The client's public id — the frontend links to /clients/{id} with it.</summary>
    public Guid ClientId { get; set; }

    public string ClientName { get; set; } = null!;
    public Region Region { get; set; }

    /// <summary>Distinct delivered stops for this client in the window.</summary>
    public int Deliveries { get; set; }

    public int Units { get; set; }
    public decimal WeightKg { get; set; }
}

public sealed record VolumeByRegionDto
{
    public Region Region { get; set; }
    public int Units { get; set; }
    public decimal WeightKg { get; set; }
}
```

- [ ] **Step 6: Write the endpoint**

`api/AleTrack/AleTrack/Features/Reports/Queries/ClientVolume/GetClientVolumeEndpoint.cs`:

```csharp
using AleTrack.Features.Reports.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Reports.Queries.ClientVolume;

/// <summary>Request for the per-client volume report over an inclusive date window.</summary>
public sealed record GetClientVolumeRequest : ReportWindowRequest;

/// <summary>
/// Per-client and per-region delivered volume for the Klienti tab.
/// </summary>
/// <remarks>
/// Same in-memory aggregation rationale as the delivery-volume endpoint: unit weight comes from
/// the unmapped <c>Product.Weight</c> equivalent, so only the row projection runs in SQL.
/// v1 counts order-line products only — client/custom extra items are out of scope (see spec).
/// </remarks>
public sealed class GetClientVolumeEndpoint(AleTrackDbContext dbContext)
    : Endpoint<GetClientVolumeRequest, ClientVolumeReportDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("reports/client-volume");
        Description(b => b
            .RequireAuthenticated()
            .WithName(nameof(GetClientVolumeEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets delivered volume per client over a date window";
            s.Responses[StatusCodes.Status200OK] = "Per-client and per-region delivered volume";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetClientVolumeRequest req, CancellationToken ct)
    {
        var rows = await DeliveredLineQuery.Project(dbContext, req.From, req.To).ToListAsync(ct);

        var topClients = rows
            .GroupBy(r => new { r.ClientPublicId, r.ClientName, r.ClientRegion })
            .Select(g => new ClientVolumeRowDto
            {
                ClientId = g.Key.ClientPublicId,
                ClientName = g.Key.ClientName,
                Region = g.Key.ClientRegion,
                // One stop is one drop-off, however many lines it carried.
                Deliveries = g.Select(r => r.StopId).Distinct().Count(),
                Units = g.Sum(r => r.Quantity),
                WeightKg = g.Sum(r => r.WeightKg)
            })
            .OrderByDescending(c => c.WeightKg)
            .ThenBy(c => c.ClientName)
            .ToList();

        var result = new ClientVolumeReportDto
        {
            ClientsServed = topClients.Count,
            TotalDeliveries = topClients.Sum(c => c.Deliveries),
            TotalWeightKg = rows.Sum(r => r.WeightKg),
            TopClients = topClients,
            ByRegion = rows
                .GroupBy(r => r.ClientRegion)
                .Select(g => new VolumeByRegionDto
                {
                    Region = g.Key,
                    Units = g.Sum(r => r.Quantity),
                    WeightKg = g.Sum(r => r.WeightKg)
                })
                .OrderByDescending(r => r.WeightKg)
                .ToList()
        };

        await Send.OkAsync(result, ct);
    }
}
```

- [ ] **Step 7: Run the tests and watch them pass**

```bash
cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~GetClientVolumeEndpointTests"
```

Expected: PASS, 4 tests. Then the full suite: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj` → 149 passed.

- [ ] **Step 8: Commit**

```bash
git add api/AleTrack/AleTrack/Features/Reports/Queries/ClientVolume \
        api/AleTrack/AleTrack/Features/Reports/Utils/DeliveredLineRow.cs \
        api/AleTrack/AleTrack.Tests/Features/Reports/ClientVolumeReportTests.cs \
        api/AleTrack/AleTrack.Tests/Builders/DeliveredShipmentBuilder.cs
git commit -m "feat(reports): per-client volume endpoint

Deliveries counts distinct shipment stops, not dates — the prototype
approximated it by date because it has no stop concept."
```

---

## Task 3: Operations endpoint (Provoz)

**Files:**
- Create: `api/AleTrack/AleTrack/Features/Reports/Queries/Operations/OperationsReportDto.cs`
- Create: `api/AleTrack/AleTrack/Features/Reports/Queries/Operations/GetOperationsEndpoint.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/Reports/OperationsReportTests.cs`

**Interfaces:**
- Consumes from Tasks 1–2: `DeliveredLineQuery.Project`, `DeliveredLineRow`,
  `ReportWindowRequest`, `ReportBucketing.BucketStart`, `DailyBucket`,
  `DeliveredShipmentBuilder.Build(deliveryDate, state, lines, region, orderState,
  requiredDeliveryDate, actualDeliveryDate, returns)`, `LineSpec`.
- Produces:
  - `OperationsReportDto { List<ShipmentStateCountDto> ShipmentsByState; int TotalShipments; int TotalStops; decimal OnTimePercentage; int ReturnableUnits; int ActiveDrivers; List<IncomingVsOutgoingDto> IncomingVsOutgoing; List<DriverShipmentsDto> ByDriver; }`
  - Route: `GET reports/operations?From=&To=`

**Deviations from spec to record in the commit message:** the spec's
`OperationsReportDto` omits `TotalShipments`, `TotalStops` and `ActiveDrivers`, but
the prototype's four Provoz KPIs need them (lines 956–959: "Vývozů celkem" with an
"*N* zastávek" hint, and "Aktivních řidičů"). `TotalShipments` is derivable from
`ShipmentsByState` but is returned explicitly so the KPI does not depend on the
frontend re-summing it.

**`ReturnableUnits` — the branch dependency.** Written below against
`OutgoingShipment.Returns` (`OutgoingShipmentReturn`), which is what exists on `dev`.
If `feat/order-returns` has already landed, replace the returns block with
`stop.ClientOrder!.Returns` and keep everything else.

**`IncomingVsOutgoing` uses one unit on one axis** (kg both sides) — never a second
y-scale. Incoming weight comes from `ProductDelivery → Stops → Items → Product`, so
it needs its own in-memory weight computation via `ProductWeightCalculator`.

- [ ] **Step 1: Write the failing test**

`api/AleTrack/AleTrack.Tests/Features/Reports/OperationsReportTests.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Products.Utils;
using AleTrack.Features.Reports.Queries.Operations;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.Reports;

public sealed class GetOperationsEndpointTests
{
    private static GetOperationsRequest Window() => new()
    {
        From = new DateOnly(2026, 7, 1),
        To = new DateOnly(2026, 7, 31)
    };

    private static GetOperationsEndpoint Endpoint(DeliveredShipmentFixture fixture) =>
        EndpointWithResponseBuilder<GetOperationsRequest, OperationsReportDto, GetOperationsEndpoint>
            .Create(fixture.DbContext.Object);

    [Fact]
    public async Task HandleAsync_CountsShipmentsByStateStopsAndDrivers()
    {
        // Arrange — one delivered shipment, one stop, one driver.
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20),
            state: OutgoingShipmentState.Delivered,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 2)]);

        var endpoint = Endpoint(fixture);

        // Act
        await endpoint.HandleAsync(Window(), CancellationToken.None);

        // Assert
        var response = endpoint.Response;
        response.Should().NotBeNull();
        response.TotalShipments.Should().Be(1);
        response.TotalStops.Should().Be(1);
        response.ShipmentsByState.Should().HaveCount(1);
        response.ShipmentsByState[0].State.Should().Be(OutgoingShipmentState.Delivered);
        response.ShipmentsByState[0].Count.Should().Be(1);
        response.ActiveDrivers.Should().Be(1);
        response.ByDriver.Should().HaveCount(1);
        response.ByDriver[0].DriverName.Should().Be("Jan Novák");
        response.ByDriver[0].Color.Should().Be("#0072B2");
        response.ByDriver[0].DeliveredShipments.Should().Be(1);
    }

    [Fact]
    public async Task HandleAsync_CountsNonDeliveredShipmentsInStateBreakdown_ButNotForDrivers()
    {
        // A shipment still in transit belongs in the state donut, but it has not been
        // delivered, so it must not count towards a driver's delivered tally.
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20),
            state: OutgoingShipmentState.InTransit,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 2)]);

        var endpoint = Endpoint(fixture);

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        var response = endpoint.Response;
        response.TotalShipments.Should().Be(1);
        response.ShipmentsByState[0].State.Should().Be(OutgoingShipmentState.InTransit);
        response.ByDriver.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleAsync_ComputesOnTimePercentage_ExcludingOrdersWithoutRequiredDate()
    {
        // On time: actual 2026-07-19 <= required 2026-07-20.
        var onTime = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20),
            state: OutgoingShipmentState.Delivered,
            orderState: OrderState.Finished,
            requiredDeliveryDate: new DateOnly(2026, 7, 20),
            actualDeliveryDate: new DateOnly(2026, 7, 19),
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 1)]);

        var endpoint = Endpoint(onTime);
        await endpoint.HandleAsync(Window(), CancellationToken.None);
        endpoint.Response.OnTimePercentage.Should().Be(100m);

        // Late: actual 2026-07-22 > required 2026-07-20.
        var late = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20),
            state: OutgoingShipmentState.Delivered,
            orderState: OrderState.Finished,
            requiredDeliveryDate: new DateOnly(2026, 7, 20),
            actualDeliveryDate: new DateOnly(2026, 7, 22),
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 1)]);

        var lateEndpoint = Endpoint(late);
        await lateEndpoint.HandleAsync(Window(), CancellationToken.None);
        lateEndpoint.Response.OnTimePercentage.Should().Be(0m);

        // No required date — excluded from the ratio entirely, so it reads 0 of 0.
        var noRequired = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20),
            state: OutgoingShipmentState.Delivered,
            orderState: OrderState.Finished,
            requiredDeliveryDate: null,
            actualDeliveryDate: new DateOnly(2026, 7, 19),
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 1)]);

        var noRequiredEndpoint = Endpoint(noRequired);
        await noRequiredEndpoint.HandleAsync(Window(), CancellationToken.None);
        noRequiredEndpoint.Response.OnTimePercentage.Should().Be(0m);
    }

    [Fact]
    public async Task HandleAsync_SumsReturnableUnits_OnDeliveredShipmentsOnly()
    {
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20),
            state: OutgoingShipmentState.Delivered,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 4)],
            returns:
            [
                new OutgoingShipmentReturn { Name = "Sud 50 l — prázdný", Quantity = 3 },
                new OutgoingShipmentReturn { Name = "Basa", Quantity = 2 }
            ]);

        var endpoint = Endpoint(fixture);

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        endpoint.Response.ReturnableUnits.Should().Be(5);
    }

    [Fact]
    public async Task HandleAsync_ReportsIncomingAndOutgoingWeightPerMonth()
    {
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20),
            state: OutgoingShipmentState.Delivered,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 2)]);

        // Incoming: 5 kegs of 30 l = 5 x 42 kg = 210 kg, same month.
        var withIncoming = DeliveredShipmentBuilder.WithIncomingDelivery(
            fixture,
            date: new DateOnly(2026, 7, 15),
            kind: ProductKind.Keg,
            packageSize: KegSize.ThirtyLiters,
            quantity: 5);

        var endpoint = Endpoint(withIncoming);

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        var response = endpoint.Response;
        response.IncomingVsOutgoing.Should().HaveCount(1);
        response.IncomingVsOutgoing[0].Month.Should().Be(new DateOnly(2026, 7, 1));
        response.IncomingVsOutgoing[0].IncomingWeightKg.Should().Be(210m);
        response.IncomingVsOutgoing[0].OutgoingWeightKg.Should().Be(124m);
    }

    [Fact]
    public async Task HandleAsync_ReturnsZeroedDto_ForEmptyWindow()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var endpoint = EndpointWithResponseBuilder<GetOperationsRequest,
            OperationsReportDto, GetOperationsEndpoint>.Create(dbContext.Object);

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        var response = endpoint.Response;
        response.TotalShipments.Should().Be(0);
        response.TotalStops.Should().Be(0);
        response.OnTimePercentage.Should().Be(0m);
        response.ReturnableUnits.Should().Be(0);
        response.ActiveDrivers.Should().Be(0);
        response.ShipmentsByState.Should().BeEmpty();
        response.IncomingVsOutgoing.Should().BeEmpty();
        response.ByDriver.Should().BeEmpty();
    }
}
```

- [ ] **Step 2: Add the incoming-delivery helper to the fixture builder**

Append to `DeliveredShipmentBuilder`:

```csharp
    /// <summary>
    /// Adds one incoming product delivery (Dovoz) in the same fixture so the incoming-vs-outgoing
    /// series has something on the incoming side.
    /// </summary>
    public static DeliveredShipmentFixture WithIncomingDelivery(
        DeliveredShipmentFixture fixture,
        DateOnly date,
        ProductKind kind,
        double packageSize,
        int quantity)
    {
        var product = ProductBuilder.BuildEntity(
            name: "Dovezený produkt",
            kind: kind,
            type: ProductType.PaleLager,
            packageSize: packageSize);
        product.Id = 500;
        product.BreweryId = fixture.Brewery.Id;
        product.Brewery = fixture.Brewery;

        var delivery = new ProductDelivery
        {
            Id = 1,
            PublicId = Guid.NewGuid(),
            Date = date,
            State = ProductDeliveryState.Finished
        };

        var stop = new DeliveryStop
        {
            Id = 1,
            PublicId = Guid.NewGuid(),
            DeliveryId = delivery.Id,
            Delivery = delivery,
            Order = 1,
            Kind = DeliveryStopKind.Brewery,
            BreweryId = fixture.Brewery.Id
        };

        var item = new DeliveryItem
        {
            Id = 1,
            DeliveryStopId = stop.Id,
            DeliveryStop = stop,
            ProductId = product.Id,
            Product = product,
            Quantity = quantity
        };

        stop.Items = [item];
        delivery.Stops = [stop];

        var allProducts = fixture.OrderItems.Select(oi => oi.Product).Append(product).ToList();

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [fixture.Client],
            breweries: [fixture.Brewery],
            products: allProducts,
            orders: [fixture.Order],
            orderItems: fixture.OrderItems,
            drivers: [fixture.Driver],
            productDeliveries: [delivery],
            deliveryItems: [item],
            outgoingShipments: [fixture.Shipment]);

        return fixture with { DbContext = dbContext };
    }
```

> If `DeliveryStop.Delivery` or `DeliveryStopKind.Brewery` do not match the entity as
> written, read `Entities/DeliveryStop.cs` and `Common/Enums/DeliveryStopKind.cs` and
> use the real member names — do not invent them.

- [ ] **Step 3: Run the tests and watch them fail**

```bash
cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~GetOperationsEndpointTests"
```

Expected: **build error** — `GetOperationsEndpoint` / `OperationsReportDto` do not exist.

- [ ] **Step 4: Write the DTO**

`api/AleTrack/AleTrack/Features/Reports/Queries/Operations/OperationsReportDto.cs`:

```csharp
using AleTrack.Common.Enums;

namespace AleTrack.Features.Reports.Queries.Operations;

/// <summary>How the operation ran over a window — throughput, punctuality, returns, drivers.</summary>
public sealed record OperationsReportDto
{
    /// <summary>Outgoing shipments in the window, by state. Includes non-delivered states.</summary>
    public List<ShipmentStateCountDto> ShipmentsByState { get; set; } = [];

    /// <summary>All outgoing shipments in the window, any state.</summary>
    public int TotalShipments { get; set; }

    /// <summary>Order stops across those shipments — the drop-off count.</summary>
    public int TotalStops { get; set; }

    /// <summary>
    /// Percent of finished orders delivered by their required date. Orders without a required
    /// date are excluded from the ratio; 0 when nothing qualifies.
    /// </summary>
    public decimal OnTimePercentage { get; set; }

    /// <summary>Returnable units handed back on delivered shipments.</summary>
    public int ReturnableUnits { get; set; }

    /// <summary>Drivers with at least one delivered shipment in the window.</summary>
    public int ActiveDrivers { get; set; }

    /// <summary>Incoming vs outgoing weight per calendar month, both in kilograms on one scale.</summary>
    public List<IncomingVsOutgoingDto> IncomingVsOutgoing { get; set; } = [];

    public List<DriverShipmentsDto> ByDriver { get; set; } = [];
}

public sealed record ShipmentStateCountDto
{
    public OutgoingShipmentState State { get; set; }
    public int Count { get; set; }
}

public sealed record IncomingVsOutgoingDto
{
    /// <summary>First day of the month the pair belongs to.</summary>
    public DateOnly Month { get; set; }

    public decimal IncomingWeightKg { get; set; }
    public decimal OutgoingWeightKg { get; set; }
}

public sealed record DriverShipmentsDto
{
    public Guid DriverId { get; set; }
    public string DriverName { get; set; } = null!;

    /// <summary>The driver's own display colour, so the chart keys off the entity, not its rank.</summary>
    public string? Color { get; set; }

    public int DeliveredShipments { get; set; }
}
```

- [ ] **Step 5: Write the endpoint**

`api/AleTrack/AleTrack/Features/Reports/Queries/Operations/GetOperationsEndpoint.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Features.Products.Utils;
using AleTrack.Features.Reports.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Reports.Queries.Operations;

/// <summary>Request for the operations report over an inclusive date window.</summary>
public sealed record GetOperationsRequest : ReportWindowRequest;

/// <summary>
/// Operational figures for the Provoz tab: shipment states, punctuality, returnables,
/// incoming vs outgoing weight, and per-driver throughput.
/// </summary>
/// <remarks>
/// Weights are summed in memory for the same reason as the other report endpoints — the per-unit
/// figure comes from <see cref="ProductWeightCalculator"/>, which EF Core cannot translate.
/// v1 counts order-line products only on the outgoing side.
/// </remarks>
public sealed class GetOperationsEndpoint(AleTrackDbContext dbContext)
    : Endpoint<GetOperationsRequest, OperationsReportDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("reports/operations");
        Description(b => b
            .RequireAuthenticated()
            .WithName(nameof(GetOperationsEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets operational figures over a date window";
            s.Responses[StatusCodes.Status200OK] = "Shipment states, punctuality, returns and driver throughput";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetOperationsRequest req, CancellationToken ct)
    {
        // Kind=Utc is mandatory: DeliveryDate is timestamptz and Npgsql rejects Unspecified.
        var fromDate = req.From.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var toDate = req.To.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

        // Shipment-level facts. Projected flat so nothing computed leaks into SQL.
        var shipments = await dbContext.OutgoingShipments
            .Where(s => s.DeliveryDate != null && s.DeliveryDate >= fromDate && s.DeliveryDate <= toDate)
            .Select(s => new
            {
                s.State,
                DeliveryDate = s.DeliveryDate!.Value,
                OrderStopCount = s.Stops.Count(st => st.Kind == OutgoingShipmentStopKind.Order),
                ReturnedUnits = s.Returns.Sum(r => (int?)r.Quantity) ?? 0,
                Drivers = s.Drivers.Select(d => new
                {
                    d.Driver.PublicId,
                    d.Driver.FirstName,
                    d.Driver.LastName,
                    d.Driver.Color
                }).ToList()
            })
            .ToListAsync(ct);

        var delivered = shipments.Where(s => s.State == OutgoingShipmentState.Delivered).ToList();

        // Punctuality over finished orders that actually carry a required date.
        var punctuality = await dbContext.Orders
            .Where(o => o.State == OrderState.Finished
                        && o.RequiredDeliveryDate != null
                        && o.ActualDeliveryDate != null
                        && o.ActualDeliveryDate >= req.From
                        && o.ActualDeliveryDate <= req.To)
            .Select(o => new { Required = o.RequiredDeliveryDate!.Value, Actual = o.ActualDeliveryDate!.Value })
            .ToListAsync(ct);

        var onTimePercentage = punctuality.Count == 0
            ? 0m
            : Math.Round(punctuality.Count(p => p.Actual <= p.Required) * 100m / punctuality.Count, 1);

        // Outgoing weight per month, from the shared delivered-line projection.
        var outgoingRows = await DeliveredLineQuery.Project(dbContext, req.From, req.To).ToListAsync(ct);
        var outgoingByMonth = outgoingRows
            .GroupBy(r => ReportBucketing.BucketStart(r.Date, ReportGranularity.Month))
            .ToDictionary(g => g.Key, g => g.Sum(r => r.WeightKg));

        // Incoming weight per month — raw columns only, weight computed below.
        var incomingRows = await dbContext.DeliveryItems
            // Finished only, mirroring the outgoing side's delivered-only rule. The spec's
            // "delivered = actuals, not plans" principle applies to both sides of this chart:
            // counting planned or cancelled Dovozy against delivered Vyvozy would compare
            // unlike quantities on a shared axis.
            .Where(di => di.DeliveryStop.Delivery.State == ProductDeliveryState.Finished
                         && di.DeliveryStop.Delivery.Date >= req.From
                         && di.DeliveryStop.Delivery.Date <= req.To)
            .Select(di => new
            {
                di.DeliveryStop.Delivery.Date,
                di.Product.Kind,
                di.Product.PackageSize,
                di.Quantity
            })
            .ToListAsync(ct);

        var incomingByMonth = incomingRows
            .GroupBy(r => ReportBucketing.BucketStart(r.Date, ReportGranularity.Month))
            .ToDictionary(
                g => g.Key,
                g => g.Sum(r => (decimal)((ProductWeightCalculator.Compute(r.Kind, r.PackageSize) ?? 0d) * r.Quantity)));

        var result = new OperationsReportDto
        {
            TotalShipments = shipments.Count,
            TotalStops = shipments.Sum(s => s.OrderStopCount),
            OnTimePercentage = onTimePercentage,
            ReturnableUnits = delivered.Sum(s => s.ReturnedUnits),

            ShipmentsByState = shipments
                .GroupBy(s => s.State)
                .Select(g => new ShipmentStateCountDto { State = g.Key, Count = g.Count() })
                .OrderBy(s => s.State)
                .ToList(),

            ByDriver = delivered
                .SelectMany(s => s.Drivers)
                .GroupBy(d => new { d.PublicId, d.FirstName, d.LastName, d.Color })
                .Select(g => new DriverShipmentsDto
                {
                    DriverId = g.Key.PublicId,
                    DriverName = $"{g.Key.FirstName} {g.Key.LastName}",
                    Color = g.Key.Color,
                    DeliveredShipments = g.Count()
                })
                .OrderByDescending(d => d.DeliveredShipments)
                .ThenBy(d => d.DriverName)
                .ToList(),

            IncomingVsOutgoing = outgoingByMonth.Keys
                .Union(incomingByMonth.Keys)
                .OrderBy(m => m)
                .Select(m => new IncomingVsOutgoingDto
                {
                    Month = m,
                    IncomingWeightKg = incomingByMonth.GetValueOrDefault(m),
                    OutgoingWeightKg = outgoingByMonth.GetValueOrDefault(m)
                })
                .ToList()
        };

        result.ActiveDrivers = result.ByDriver.Count;

        await Send.OkAsync(result, ct);
    }
}
```

- [ ] **Step 6: Run the tests and watch them pass**

```bash
cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~GetOperationsEndpointTests"
```

Expected: PASS, 6 tests. Then the full suite: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj` → 155 passed.

- [ ] **Step 7: Verify the endpoints against a real database — the step tests cannot do**

The mocked DbContext is LINQ-to-objects and will happily evaluate anything. Npgsql will
not. Run the API and hit all three endpoints for real:

```bash
# from api/AleTrack — needs the local Postgres up (docker compose up -d) and migrations applied
ASPNETCORE_ENVIRONMENT=Development.Local dotnet run --project AleTrack --launch-profile Local
```

Then, with a bearer token from `POST /ale-track/login`:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/ale-track/reports/delivery-volume?From=2026-01-01&To=2026-12-31&Granularity=Week" | head -c 400
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/ale-track/reports/client-volume?From=2026-01-01&To=2026-12-31" | head -c 400
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/ale-track/reports/operations?From=2026-01-01&To=2026-12-31" | head -c 400
```

Expected: three `200`s with JSON bodies. A `500` mentioning *"could not be translated"*
means a computed property leaked into a query — fix the projection, do not work around it.
**Do not proceed to Task 4 until all three return 200 against Postgres.**

- [ ] **Step 8: Commit**

```bash
git add api/AleTrack/AleTrack/Features/Reports/Queries/Operations \
        api/AleTrack/AleTrack.Tests/Features/Reports/OperationsReportTests.cs \
        api/AleTrack/AleTrack.Tests/Builders/DeliveredShipmentBuilder.cs
git commit -m "feat(reports): operations endpoint

Adds TotalShipments, TotalStops and ActiveDrivers beyond the spec's DTO — the
prototype's Provoz KPIs need them. Returns are read off OutgoingShipment.Returns,
which moves to Order.Returns once feat/order-returns lands."
```

---

## Task 4: Register the module, regenerate the client, wire the hooks and the model

**Files:**
- Modify: `api/AleTrack/AleTrack/Common/Enums/ModuleType.cs` (append `Reports`)
- Modify: `app/package.json` (add `@mui/x-charts`)
- Modify: `app/src/auth/permissions.ts:6-17` (add `'reports'` to `MODULE_KEYS`)
- Modify: `app/src/routes/paths.ts:3-14` (add `reports: '/reports'`)
- Modify: `app/src/layout/nav-config.tsx` (new `Analýza` group)
- Modify: `app/src/features/users/permissionModel.ts:21-31` (add `reports` → `ModuleType.Reports`)
- Modify: `app/src/routes/router.tsx` (add the route)
- Modify: `app/src/api/queryKeys.ts:17` (add report keys)
- Modify: `app/src/hooks/useReports.ts` (three new hooks)
- Modify: `app/src/generated/api-client.ts` (regenerate — never hand-edit)
- Create: `app/src/features/reports/reportModel.ts`
- Test: `app/src/features/reports/reportModel.test.ts`

**Interfaces:**
- Consumes from Tasks 1–3: routes `reports/delivery-volume`, `reports/client-volume`,
  `reports/operations`; generated methods
  `getDeliveryVolumeEndpoint(from, to, granularity, signal)`,
  `getClientVolumeEndpoint(from, to, signal)`,
  `getOperationsEndpoint(from, to, signal)` — **verify the exact generated names and
  argument order in `src/generated/api-client.ts` after regenerating; NSwag derives
  them from `WithName(...)` and the query-parameter order, and this plan's guesses
  are not authoritative.**
- Produces:
  - `type ReportPeriod = '30' | '90' | '180'`, `type ReportTab = 'volume' | 'clients' | 'operational'`
  - `periodRange(period: ReportPeriod, today?: Date) → { from: string; to: string }` (ISO `YYYY-MM-DD`)
  - `PERIOD_LABEL: Record<ReportPeriod, string>`, `PERIOD_OPTIONS`, `TAB_OPTIONS`
  - `fmtKg(kg: number) → string`, `sharePct(part: number, total: number) → string`
  - `useDeliveryVolume(from, to, granularity, enabled)`, `useClientVolume(from, to, enabled)`,
    `useOperationsReport(from, to, enabled)`
  - `qk.reportVolume(params)`, `qk.reportClients(params)`, `qk.reportOperations(params)`

**Why the backend enum changes here:** `PERM_MODULES` in `permissionModel.ts:19` is
derived from `NAV_GROUPS` minus `dashboard`, so adding a `reports` nav item
automatically adds a Reporty row to the user permission matrix. `KEY_TO_MODULE` has no
`reports` entry, so saving that row would post `module: undefined`. Appending `Reports`
to the backend `ModuleType` enum is safe — the column is `integer` and existing members
keep their ordinals.

**Deviation from spec:** the spec says report keys live at `qk.reports.*(params)`, but
`qk.reports` is already the flat array `['reports']` used by `useModuleCounts`. Turning
it into an object would break that hook, so the new keys are siblings
(`qk.reportVolume`, …) that still nest under the `'reports'` root for invalidation.

- [ ] **Step 1: Append the backend module type and rebuild**

In `api/AleTrack/AleTrack/Common/Enums/ModuleType.cs`, append **after** `Users` (order
matters — the column is an integer):

```csharp
    /// <summary>Uživatelé (user administration).</summary>
    Users,

    /// <summary>Reporty (read-only analytics).</summary>
    Reports
}
```

```bash
cd api/AleTrack && dotnet build AleTrack.sln && dotnet test AleTrack.Tests/AleTrack.Tests.csproj
```

Expected: build 0 errors, 155 tests pass. No migration is needed — the enum is stored
as an integer and nothing about the column changed.

- [ ] **Step 2: Install the charting library**

```bash
cd app && yarn add @mui/x-charts@^8.29.0
```

Expected: `@mui/x-charts@8.29.x` in `dependencies`. Confirm no peer warning naming
`@mui/material` — if one appears, you installed 9.x; remove it and pin 8.

- [ ] **Step 3: Regenerate the API client against the running backend**

```bash
# terminal 1 — from api/AleTrack
ASPNETCORE_ENVIRONMENT=Development.Local dotnet run --project AleTrack --launch-profile Local
# terminal 2 — from app
yarn generate-api
```

Then confirm the three methods exist and note their real signatures:

```bash
grep -n "DeliveryVolume\|ClientVolume\|OperationsEndpoint" src/generated/api-client.ts | head -20
```

Expected: three `get*` methods plus `DeliveryVolumeReportDto`, `ClientVolumeReportDto`,
`OperationsReportDto` classes. Use the **actual** names in Step 6.

- [ ] **Step 4: Register the module (permissions, path, nav, permission bridge, route)**

`src/auth/permissions.ts` — add `'reports'` right after `'dashboard'` so the union and
the matrix order follow the nav:

```ts
export const MODULE_KEYS = [
  'dashboard',
  'reports',
  'orders',
  ...
```

`src/routes/paths.ts` — add the path (the `Record<ModuleKey, string>` type makes this
mandatory, not optional):

```ts
export const PATHS: Record<ModuleKey, string> = {
  dashboard: '/',
  reports: '/reports',
  orders: '/orders',
  ...
```

`src/layout/nav-config.tsx` — import the icon and add the group **after** the `Sklad`
group, mirroring the prototype (`aletrack-prototype.html:689`):

```tsx
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
```

```tsx
  {
    heading: 'Analýza',
    items: [
      { key: 'reports', label: 'Reporty', path: PATHS.reports, icon: icon(<InsightsOutlinedIcon fontSize="small" />) },
    ],
  },
```

`src/features/users/permissionModel.ts` — add the mapping so the new matrix row saves:

```ts
const KEY_TO_MODULE: Record<string, ModuleType> = {
  reports: ModuleType.Reports,
  orders: ModuleType.Orders,
  ...
```

`src/routes/router.tsx` — import and add the route inside the `AppShell` children,
directly after the dashboard index route. **`ReportsPage` is created in Task 8**, so add
this import and route only once that task runs — or add them now and accept a red
typecheck until Task 8, whichever your execution order makes cleaner. Do not stub the
component.

```tsx
import { ReportsPage } from 'src/features/reports/ReportsPage';
```

```tsx
          { index: true, element: <DashboardPage /> },
          { path: PATHS.reports, element: <ReportsPage /> },
```

- [ ] **Step 5: Add the query keys**

`src/api/queryKeys.ts` — replace the single `reports` line with:

```ts
  // `reports` stays a flat array: useModuleCounts keys off it directly. The report
  // screens get sibling factories nested under the same root so invalidating
  // ['reports'] still clears them.
  reports: ['reports'] as const,
  reportVolume: (params: Params = {}) => ['reports', 'volume', params] as const,
  reportClients: (params: Params = {}) => ['reports', 'clients', params] as const,
  reportOperations: (params: Params = {}) => ['reports', 'operations', params] as const,
```

- [ ] **Step 6: Add the hooks**

Append to `src/hooks/useReports.ts` (adjust the generated method names/arg order to
match Step 3's output):

```ts
import type { ReportGranularity } from 'src/generated/api-client';

/** Delivered volume for the Objem tab. Only fetched while that tab is active. */
export function useDeliveryVolume(
  from: string,
  to: string,
  granularity: ReportGranularity,
  enabled = true
) {
  return useQuery({
    queryKey: qk.reportVolume({ from, to, granularity: String(granularity) }),
    queryFn: ({ signal }) => api.getDeliveryVolumeEndpoint(from, to, granularity, signal),
    enabled,
  });
}

/** Per-client volume for the Klienti tab. */
export function useClientVolume(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: qk.reportClients({ from, to }),
    queryFn: ({ signal }) => api.getClientVolumeEndpoint(from, to, signal),
    enabled,
  });
}

/** Operational figures for the Provoz tab. */
export function useOperationsReport(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: qk.reportOperations({ from, to }),
    queryFn: ({ signal }) => api.getOperationsEndpoint(from, to, signal),
    enabled,
  });
}
```

- [ ] **Step 7: Write the failing model test**

`app/src/features/reports/reportModel.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { periodRange, fmtKg, sharePct, PERIOD_LABEL } from './reportModel';

describe('periodRange', () => {
  it('spans the requested number of days back from today, inclusive of today', () => {
    const today = new Date('2026-07-25T12:00:00Z');
    expect(periodRange('30', today)).toEqual({ from: '2026-06-25', to: '2026-07-25' });
    expect(periodRange('90', today)).toEqual({ from: '2026-04-26', to: '2026-07-25' });
    expect(periodRange('180', today)).toEqual({ from: '2026-01-26', to: '2026-07-25' });
  });

  it('crosses a year boundary correctly', () => {
    expect(periodRange('90', new Date('2026-02-10T12:00:00Z')).from).toBe('2025-11-12');
  });
});

describe('fmtKg', () => {
  it('switches to tonnes at 1000 kg with one decimal', () => {
    expect(fmtKg(1500)).toBe('1,5 t');
    expect(fmtKg(12400)).toBe('12,4 t');
  });

  it('keeps kilograms below 1000, with no decimals', () => {
    expect(fmtKg(999)).toBe('999 kg');
    expect(fmtKg(0)).toBe('0 kg');
  });
});

describe('sharePct', () => {
  it('formats a share to one decimal', () => {
    expect(sharePct(25, 200)).toBe('12,5 %');
  });

  it('reads 0 rather than dividing by zero on an empty total', () => {
    expect(sharePct(0, 0)).toBe('0,0 %');
  });
});

describe('PERIOD_LABEL', () => {
  it('matches the prototype wording', () => {
    expect(PERIOD_LABEL['30']).toBe('posledních 30 dní');
    expect(PERIOD_LABEL['90']).toBe('posledních 90 dní');
    expect(PERIOD_LABEL['180']).toBe('posledních 6 měsíců');
  });
});
```

- [ ] **Step 8: Run it and watch it fail**

```bash
cd app && yarn vitest run src/features/reports/reportModel.test.ts
```

Expected: FAIL — cannot resolve `./reportModel`.

- [ ] **Step 9: Write the model**

`app/src/features/reports/reportModel.ts`:

```ts
// Pure shaping for the Reporty screens: the period presets, the date window they
// resolve to, and the number formats the prototype uses. Kept out of the components
// so the arithmetic is testable without rendering.
import { num } from 'src/lib/format';
import { ReportGranularity } from 'src/generated/api-client';

export type ReportTab = 'volume' | 'clients' | 'operational';
export type ReportPeriod = '30' | '90' | '180';
export type VolumeGranularity = 'week' | 'month';
export type ClientMetric = 'kg' | 'units';

export const PERIOD_LABEL: Record<ReportPeriod, string> = {
  '30': 'posledních 30 dní',
  '90': 'posledních 90 dní',
  '180': 'posledních 6 měsíců',
};

export const TAB_OPTIONS = [
  { value: 'volume' as const, label: 'Objem' },
  { value: 'clients' as const, label: 'Klienti' },
  { value: 'operational' as const, label: 'Provoz' },
];

export const PERIOD_OPTIONS = [
  { value: '30' as const, label: '30 dní' },
  { value: '90' as const, label: '90 dní' },
  { value: '180' as const, label: '6 měsíců' },
];

export const GRANULARITY_OPTIONS = [
  { value: 'week' as const, label: 'Týdně' },
  { value: 'month' as const, label: 'Měsíčně' },
];

export const METRIC_OPTIONS = [
  { value: 'kg' as const, label: 'Hmotnost' },
  { value: 'units' as const, label: 'Kusy' },
];

const API_GRANULARITY: Record<VolumeGranularity, ReportGranularity> = {
  week: ReportGranularity.Week,
  month: ReportGranularity.Month,
};

export function apiGranularity(g: VolumeGranularity): ReportGranularity {
  return API_GRANULARITY[g];
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The window a period preset resolves to — `to` is today, `from` is N days earlier. */
export function periodRange(period: ReportPeriod, today: Date = new Date()): { from: string; to: string } {
  const to = new Date(today);
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - Number(period));
  return { from: isoDate(from), to: isoDate(to) };
}

/** Weight in the prototype's format: tonnes with one decimal from 1000 kg up. */
export function fmtKg(kg: number): string {
  return kg >= 1000 ? `${num(Math.round((kg / 1000) * 10) / 10)} t` : `${num(Math.round(kg))} kg`;
}

/** A part's share of a total, one decimal, safe on a zero total. */
export function sharePct(part: number, total: number): string {
  const pct = total > 0 ? (part / total) * 100 : 0;
  return `${num(Math.round(pct * 10) / 10)} %`;
}

/** Units in the prototype's format. */
export function fmtUnits(units: number): string {
  return `${num(units)} ks`;
}
```

> `num` must render `1,5` for `1.5` and `12 400` for `12400` under `cs-CZ`. Read
> `src/lib/format.ts:3` and confirm before relying on the expected strings above; if it
> does not take a decimal count, extend the test expectations to the real output rather
> than changing `num`'s behaviour for other callers.

- [ ] **Step 10: Run it and watch it pass**

```bash
cd app && yarn vitest run src/features/reports/reportModel.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 11: Run the tests and the typecheck**

```bash
cd app && yarn vitest run src/features/reports/ && yarn typecheck
```

Expected: `reportModel.test.ts` passes (7 tests) and `yarn typecheck` is clean. No page
or tab component exists yet — the route added in Step 4 is wired in Task 8, so do **not**
create placeholder components here.

- [ ] **Step 12: Commit**

```bash
git add api/AleTrack/AleTrack/Common/Enums/ModuleType.cs app/package.json app/yarn.lock \
        app/src/auth/permissions.ts app/src/routes/paths.ts app/src/routes/router.tsx \
        app/src/layout/nav-config.tsx app/src/features/users/permissionModel.ts \
        app/src/api/queryKeys.ts app/src/hooks/useReports.ts \
        app/src/generated/api-client.ts app/src/features/reports
git commit -m "feat(reports): register the Reporty module and wire its queries

Appends ModuleType.Reports so the permission matrix row the new nav item
creates has something to map to; the column is an integer, so appending is
safe. Report query keys are siblings of qk.reports rather than nested under
it, because useModuleCounts keys off that array directly."
```

---

## Task 5: Validated palette, chart card, and the Objem tab

**Files:**
- Create: `app/src/features/reports/reportPalette.ts`
- Create: `app/src/features/reports/ChartCard.tsx`
- Create: `app/src/features/reports/VolumeTab.tsx`
- Test: `app/src/features/reports/reportPalette.test.ts`, `app/src/features/reports/VolumeTab.test.tsx`

**Interfaces:**
- Consumes from Task 4: `fmtKg`, `fmtUnits`, `sharePct`, `GRANULARITY_OPTIONS`,
  `type VolumeGranularity`; `DeliveryVolumeReportDto` from the generated client.
- Produces:
  - `REPORT_PALETTE_LIGHT` / `REPORT_PALETTE_DARK` — 7 hexes each, fixed order
  - `useReportPalette() → readonly string[]`
  - `typeSlot(type) → number` — stable slot index, identity-based
  - `foldTypes(rows) → { label: string; value: number; color: string }[]`
  - `<ChartCard title icon action>`, `<VolumeTab data granularity onGranularityChange>`

**The palette is validated, not chosen by eye.** Both arrays passed the six checks in
`skills/dataviz/scripts/validate_palette.js` against this app's real card surfaces
(`#FFFFFF` light, `#18222F` dark) — lightness band, chroma floor, adjacent-pair CVD
separation (protan/deutan/tritan), the normal-vision floor, and contrast:

```
light  → ALL CHECKS PASS   (WARN: #E69F00 2.25:1, #56B4E9 2.31:1 — relieved by the legend labels)
dark   → ALL CHECKS PASS
```

The prototype's own `TYPE_PALETTE` (`aletrack-prototype.html:781`) **fails**: `#5A6675`
and `#0E7C9B` read grey (chroma below floor), `#5A6675`↔`#DB2777` sit at ΔE 3.0 under
protanopia, and `#2F855A`↔`#5A6675` at ΔE 12.3 even with full colour vision. It also
cycles with `%` over 24 `ProductType` values **and** assigns colour after sorting by
volume, so changing the period repaints every slice. This task replaces it. **This is a
deliberate, documented deviation from prototype fidelity — colour assignment is a
correctness matter, not a styling preference. Say so in the commit message.**
Layout, wording, spacing and card structure still follow the prototype exactly.

If you change any hex, re-run the validator for **both** modes before committing:

```bash
node ~/.claude/plugins/.../dataviz/scripts/validate_palette.js "<comma,separated,hexes>" --mode light --surface "#FFFFFF"
node ~/.claude/plugins/.../dataviz/scripts/validate_palette.js "<comma,separated,hexes>" --mode dark  --surface "#18222F"
```

- [ ] **Step 1: Write the failing palette test**

`app/src/features/reports/reportPalette.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ProductType } from 'src/generated/api-client';
import { ptypeLabel } from 'src/lib/labels';
import {
  REPORT_PALETTE_DARK,
  REPORT_PALETTE_LIGHT,
  foldTypes,
  typeSlot,
} from './reportPalette';

describe('report palette', () => {
  it('has 7 slots in both schemes', () => {
    expect(REPORT_PALETTE_LIGHT).toHaveLength(7);
    expect(REPORT_PALETTE_DARK).toHaveLength(7);
  });

  it('never repeats a hex within a scheme', () => {
    expect(new Set(REPORT_PALETTE_LIGHT).size).toBe(7);
    expect(new Set(REPORT_PALETTE_DARK).size).toBe(7);
  });
});

describe('typeSlot', () => {
  it('gives a type the same slot regardless of how the data is ordered', () => {
    expect(typeSlot(ProductType.PaleLager)).toBe(typeSlot(ProductType.PaleLager));
    expect(typeSlot(ProductType.PaleLager)).not.toBe(typeSlot(ProductType.DarkLager));
  });

  it('sends every type outside the fixed six to the shared last slot', () => {
    expect(typeSlot(ProductType.Merchandise)).toBe(6);
    expect(typeSlot(ProductType.Lemonade)).toBe(6);
    expect(typeSlot(ProductType.Mix)).toBe(6);
  });
});

describe('foldTypes', () => {
  const palette = REPORT_PALETTE_LIGHT;

  it('colours a type by identity, so reordering the rows does not repaint it', () => {
    const pale = { type: ProductType.PaleLager, weightKg: 90, units: 9 };
    const dark = { type: ProductType.DarkLager, weightKg: 10, units: 1 };

    const ascending = foldTypes([dark, pale], palette);
    const descending = foldTypes([pale, dark], palette);

    // Each type keeps its own slot colour whichever order it arrived in, and the two
    // types never share a colour.
    const paleColor = palette[typeSlot(ProductType.PaleLager)];
    const darkColor = palette[typeSlot(ProductType.DarkLager)];
    expect(paleColor).not.toBe(darkColor);

    for (const rows of [ascending, descending]) {
      expect(rows.find((r) => r.value === 90)!.color).toBe(paleColor);
      expect(rows.find((r) => r.value === 10)!.color).toBe(darkColor);
    }
  });

  it('changing which type leads does not change any type\'s colour', () => {
    // The prototype's bug: it sorted by volume, then indexed the palette by position,
    // so a period change repainted every slice. Guard against a regression.
    const heavyPale = foldTypes(
      [
        { type: ProductType.PaleLager, weightKg: 900, units: 9 },
        { type: ProductType.DarkLager, weightKg: 10, units: 1 },
      ],
      palette
    );
    const heavyDark = foldTypes(
      [
        { type: ProductType.PaleLager, weightKg: 10, units: 1 },
        { type: ProductType.DarkLager, weightKg: 900, units: 9 },
      ],
      palette
    );

    const colorOf = (rows: typeof heavyPale, label: string) => rows.find((r) => r.label === label)!.color;
    const paleLabel = ptypeLabel(ProductType.PaleLager)!;
    const darkLabel = ptypeLabel(ProductType.DarkLager)!;

    expect(colorOf(heavyPale, paleLabel)).toBe(colorOf(heavyDark, paleLabel));
    expect(colorOf(heavyPale, darkLabel)).toBe(colorOf(heavyDark, darkLabel));
  });

  it('merges everything beyond the fixed six into one Ostatní row', () => {
    const rows = foldTypes(
      [
        { type: ProductType.Merchandise, weightKg: 5, units: 1 },
        { type: ProductType.Lemonade, weightKg: 7, units: 2 },
      ],
      palette
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('Ostatní');
    expect(rows[0].value).toBe(12);
    expect(rows[0].color).toBe(palette[6]);
  });

  it('sorts rows by value descending while keeping Ostatní last', () => {
    const rows = foldTypes(
      [
        { type: ProductType.Merchandise, weightKg: 1000, units: 1 },
        { type: ProductType.PaleLager, weightKg: 10, units: 1 },
        { type: ProductType.DarkLager, weightKg: 20, units: 1 },
      ],
      palette
    );

    expect(rows.map((r) => r.label)).toEqual(['Tmavý ležák', 'Světlý ležák', 'Ostatní']);
  });

  it('returns nothing for no rows', () => {
    expect(foldTypes([], palette)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd app && yarn vitest run src/features/reports/reportPalette.test.ts
```

Expected: FAIL — cannot resolve `./reportPalette`.

- [ ] **Step 3: Write the palette module**

`app/src/features/reports/reportPalette.ts`:

```ts
// Categorical palette for the Reporty charts.
//
// Both arrays are VALIDATED, not picked by eye — they pass the lightness band, chroma
// floor, adjacent-pair CVD separation (protan/deutan/tritan), normal-vision floor and
// contrast checks against this app's card surfaces (#FFFFFF light, #18222F dark). The
// base hues are Okabe-Ito, which is designed for colour-vision deficiency; the dark
// steps are re-selected for the narrower dark lightness band, not flipped.
//
// Deliberate deviation from the prototype: its TYPE_PALETTE fails those checks (two
// near-grey hues, a protan pair at ΔE 3.0), cycles with % over 24 ProductType values,
// and assigns colour after sorting by volume — so changing the period repainted every
// slice. Colour here follows the ENTITY, never its rank.
//
// In light mode the amber and sky-blue slots sit just under 3:1 against a white card,
// so any chart using them must show its legend labels. Do not hide the legend.
import { useColorScheme } from '@mui/material/styles';
import { ProductType } from 'src/generated/api-client';
import { ptypeLabel } from 'src/lib/labels';

export const REPORT_PALETTE_LIGHT = [
  '#E69F00', // amber
  '#56B4E9', // sky
  '#009E73', // green
  '#0072B2', // blue
  '#D55E00', // vermillion
  '#7C3AED', // purple
  '#CC79A7', // pink — also the shared "Ostatní" slot
] as const;

export const REPORT_PALETTE_DARK = [
  '#C48300',
  '#3E9BD4',
  '#009E73',
  '#2C7FC0',
  '#D55E00',
  '#8B5CF6',
  '#BB6E96',
] as const;

/** The slot index shared by every product type outside the fixed six. */
export const OTHER_SLOT = 6;

/**
 * The six product types that get their own hue. Chosen by catalogue prominence and
 * FIXED — never derived from the data, so a period change cannot repaint a slice.
 */
const TYPE_SLOTS: Partial<Record<ProductType, number>> = {
  [ProductType.PaleDraftBeer]: 0,
  [ProductType.PaleLager]: 1,
  [ProductType.DarkLager]: 2,
  [ProductType.AmberLager]: 3,
  [ProductType.SpecialBeer]: 4,
  [ProductType.NonAlcoholicBeer]: 5,
};

/** The palette for the active colour scheme. */
export function useReportPalette(): readonly string[] {
  const { mode, systemMode } = useColorScheme();
  const resolved = mode === 'system' ? systemMode : mode;
  return resolved === 'dark' ? REPORT_PALETTE_DARK : REPORT_PALETTE_LIGHT;
}

/** Stable slot for a product type; everything unlisted shares the last slot. */
export function typeSlot(type: ProductType | string | number): number {
  const numeric = typeof type === 'number' ? type : Number(ProductType[type as keyof typeof ProductType] ?? NaN);
  return TYPE_SLOTS[numeric as ProductType] ?? OTHER_SLOT;
}

export interface TypeVolumeRow {
  type: ProductType | string | number;
  weightKg: number;
  units: number;
}

export interface ChartSlice {
  label: string;
  value: number;
  color: string;
}

/**
 * Folds per-type volume into at most seven slices: the six fixed types plus a single
 * merged "Ostatní". Sorted heaviest first with Ostatní pinned last, so the legend reads
 * top-down while the colours stay bound to identity.
 */
export function foldTypes(rows: TypeVolumeRow[], palette: readonly string[]): ChartSlice[] {
  const bySlot = new Map<number, { value: number; label: string }>();

  for (const row of rows) {
    const slot = typeSlot(row.type);
    const label = slot === OTHER_SLOT ? 'Ostatní' : (ptypeLabel(row.type) ?? 'Ostatní');
    const current = bySlot.get(slot);
    bySlot.set(slot, { value: (current?.value ?? 0) + row.weightKg, label: current?.label ?? label });
  }

  return [...bySlot.entries()]
    .map(([slot, v]) => ({ label: v.label, value: v.value, color: palette[slot] }))
    .sort((a, b) => {
      if (a.label === 'Ostatní') return 1;
      if (b.label === 'Ostatní') return -1;
      return b.value - a.value;
    });
}
```

> `ptypeLabel` returns the Czech name from `L.ptype` (`src/lib/labels.ts:83`). Confirm
> `ProductType.PaleLager` maps to `'Světlý ležák'` and `DarkLager` to `'Tmavý ležák'`
> before trusting the ordering test's expected labels; if the wording differs, fix the
> test to the real labels rather than editing `L`.

- [ ] **Step 4: Run it and watch it pass**

```bash
cd app && yarn vitest run src/features/reports/reportPalette.test.ts
```

Expected: PASS, 9 tests.

- [ ] **Step 5: Write the chart card wrapper**

`app/src/features/reports/ChartCard.tsx` — the prototype's `.card` + `.card-head`
(`aletrack-prototype.html:902`), amber icon, title, optional right-aligned control:

```tsx
import { type ReactNode } from 'react';
import { Box, Card, Stack, Typography } from '@mui/material';

/** The prototype's chart card: amber icon, title, optional control on the right. */
export function ChartCard({
  icon,
  title,
  action,
  children,
  padded = true,
}: {
  icon: ReactNode;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <Card>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.25}
        sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Box sx={{ color: 'primary.main', display: 'grid', placeItems: 'center', '& svg': { fontSize: 18 } }}>
          {icon}
        </Box>
        <Typography sx={{ fontSize: 14.5, fontWeight: 700 }}>{title}</Typography>
        {action && <Box sx={{ ml: 'auto' }}>{action}</Box>}
      </Stack>
      <Box sx={padded ? { p: 2 } : undefined}>{children}</Box>
    </Card>
  );
}
```

- [ ] **Step 6: Write the failing Objem tab test**

`app/src/features/reports/VolumeTab.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { theme } from 'src/theme/theme';
import { ProductKind, ProductType } from 'src/generated/api-client';
import { VolumeTab } from './VolumeTab';

const data = {
  totalWeightKg: 12400,
  totalUnits: 320,
  clientsServed: 14,
  unitsByKind: [
    { kind: ProductKind.Keg, units: 120, weightKg: 7440 },
    { kind: ProductKind.Bottle, units: 100, weightKg: 3000 },
    { kind: ProductKind.Can, units: 100, weightKg: 1960 },
  ],
  byBrewery: [
    { breweryId: 'b1', breweryName: 'Pivovar Zittau', color: '#E69F00', units: 200, weightKg: 9000 },
    { breweryId: 'b2', breweryName: 'Pivovar Chemnitz', color: '#0072B2', units: 120, weightKg: 3400 },
  ],
  byType: [
    { type: ProductType.PaleLager, units: 200, weightKg: 9000 },
    { type: ProductType.DarkLager, units: 120, weightKg: 3400 },
  ],
  series: [
    { bucketStart: '2026-07-06', weightKg: 5000, units: 140 },
    { bucketStart: '2026-07-13', weightKg: 7400, units: 180 },
  ],
} as never;

function renderTab(overrides: Partial<Record<string, unknown>> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <VolumeTab
        data={{ ...(data as object), ...overrides } as never}
        granularity="week"
        onGranularityChange={vi.fn()}
      />
    </ThemeProvider>
  );
}

describe('VolumeTab', () => {
  it('shows the four prototype KPIs with tonnes above 1000 kg', () => {
    renderTab();

    expect(screen.getByText('Celkem dodáno')).toBeInTheDocument();
    expect(screen.getByText('12,4 t')).toBeInTheDocument();
    expect(screen.getByText('14 klientů obslouženo')).toBeInTheDocument();
    expect(screen.getByText('Sudy')).toBeInTheDocument();
    expect(screen.getByText('Lahve (basy)')).toBeInTheDocument();
    expect(screen.getByText('Plechovky / multipack')).toBeInTheDocument();
  });

  it('lists every brewery and product kind with its share', () => {
    renderTab();

    expect(screen.getByText('Pivovar Zittau')).toBeInTheDocument();
    expect(screen.getByText('Pivovar Chemnitz')).toBeInTheDocument();
    // Kind table: 7440 / 12400 = 60,0 %
    expect(screen.getByText('60,0 %')).toBeInTheDocument();
  });

  it('keeps the legend visible — the amber and sky slots need its labels for contrast', () => {
    renderTab();

    expect(screen.getByText('Světlý ležák')).toBeInTheDocument();
    expect(screen.getByText('Tmavý ležák')).toBeInTheDocument();
  });

  it('survives an all-zero window without crashing or dividing by zero', () => {
    renderTab({
      totalWeightKg: 0, totalUnits: 0, clientsServed: 0,
      unitsByKind: [], byBrewery: [], byType: [], series: [],
    });

    expect(screen.getByText('0 kg')).toBeInTheDocument();
    expect(screen.getByText('Za zvolené období nejsou žádná data.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run it and watch it fail**

```bash
cd app && yarn vitest run src/features/reports/VolumeTab.test.tsx
```

Expected: FAIL — cannot resolve `./VolumeTab`.

- [ ] **Step 8: Write the Objem tab**

`app/src/features/reports/VolumeTab.tsx`:

```tsx
import { Box, Card, Stack, Typography } from '@mui/material';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import SportsBarOutlinedIcon from '@mui/icons-material/SportsBarOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import { LineChart } from '@mui/x-charts/LineChart';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { StatCard } from 'src/components/common/StatCard';
import { SegControl } from 'src/components/common/SegControl';
import { DataTable, type Column } from 'src/components/common/DataTable';
import { EmptyState } from 'src/components/common/EmptyState';
import { type DeliveryVolumeReportDto } from 'src/generated/api-client';
import { fmtDateShort, num } from 'src/lib/format';
import { kindLabel } from 'src/lib/labels';
import { ChartCard } from './ChartCard';
import { GRANULARITY_OPTIONS, fmtKg, fmtUnits, sharePct, type VolumeGranularity } from './reportModel';
import { foldTypes, useReportPalette } from './reportPalette';

interface KindRow {
  kind: string;
  units: number;
  weightKg: number;
}

/**
 * Objem — delivered volume: four KPIs, a trend, per-brewery and per-type breakdowns,
 * and a per-package table. Ported from the prototype's `repVolume` (line 883).
 */
export function VolumeTab({
  data,
  granularity,
  onGranularityChange,
}: {
  data: DeliveryVolumeReportDto;
  granularity: VolumeGranularity;
  onGranularityChange: (g: VolumeGranularity) => void;
}) {
  const palette = useReportPalette();

  const total = data.totalWeightKg ?? 0;
  const kinds = data.unitsByKind ?? [];
  const breweries = data.byBrewery ?? [];
  const series = data.series ?? [];

  // Kind buckets the prototype's KPIs use; cans and multipacks share one tile.
  const kegUnits = kinds.filter((k) => String(k.kind) === 'Keg' || Number(k.kind) === 1).reduce((s, k) => s + (k.units ?? 0), 0);
  const bottleUnits = kinds.filter((k) => String(k.kind) === 'Bottle' || Number(k.kind) === 2).reduce((s, k) => s + (k.units ?? 0), 0);
  const canUnits = kinds
    .filter((k) => ['Can', 'Multipack'].includes(String(k.kind)) || [3, 4].includes(Number(k.kind)))
    .reduce((s, k) => s + (k.units ?? 0), 0);

  const typeSlices = foldTypes(
    (data.byType ?? []).map((t) => ({ type: t.type!, weightKg: t.weightKg ?? 0, units: t.units ?? 0 })),
    palette
  );

  const kindColumns: Column<KindRow>[] = [
    { key: 'kind', header: 'Obal', render: (r) => kindLabel(r.kind) ?? r.kind },
    { key: 'units', header: 'Kusů', align: 'right', render: (r) => num(r.units) },
    { key: 'weight', header: 'Hmotnost', align: 'right', render: (r) => fmtKg(r.weightKg) },
    { key: 'share', header: 'Podíl', align: 'right', render: (r) => sharePct(r.weightKg, total) },
  ];

  if (total === 0 && kinds.length === 0 && series.length === 0) {
    return (
      <>
        <KpiRow
          total={total}
          clientsServed={data.clientsServed ?? 0}
          kegUnits={0}
          bottleUnits={0}
          canUnits={0}
        />
        <Card sx={{ mt: 2 }}>
          <EmptyState title="Za zvolené období nejsou žádná data." />
        </Card>
      </>
    );
  }

  return (
    <>
      <KpiRow
        total={total}
        clientsServed={data.clientsServed ?? 0}
        kegUnits={kegUnits}
        bottleUnits={bottleUnits}
        canUnits={canUnits}
      />

      <Stack spacing={2} sx={{ mt: 2 }}>
        <ChartCard
          icon={<InsightsOutlinedIcon />}
          title="Dodané množství v čase"
          action={
            <SegControl value={granularity} onChange={onGranularityChange} options={GRANULARITY_OPTIONS} />
          }
        >
          <Box sx={{ width: '100%', height: 260 }}>
            <LineChart
              series={[{ data: series.map((p) => p.weightKg ?? 0), label: 'Hmotnost', area: true, color: palette[0] }]}
              xAxis={[{ scaleType: 'point', data: series.map((p) => fmtDateShort(p.bucketStart)), height: 28 }]}
              yAxis={[{ width: 56, valueFormatter: (v: number) => num(v) }]}
              margin={{ right: 16 }}
              hideLegend
            />
          </Box>
        </ChartCard>

        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1.25fr 1fr' }, alignItems: 'start' }}>
          <ChartCard icon={<SportsBarOutlinedIcon />} title="Podle pivovaru">
            <Box sx={{ width: '100%', height: 40 + breweries.length * 46 }}>
              <BarChart
                layout="horizontal"
                series={[{ data: breweries.map((b) => b.weightKg ?? 0), valueFormatter: (v) => fmtKg(v ?? 0) }]}
                yAxis={[{ scaleType: 'band', data: breweries.map((b) => b.breweryName ?? '—'), width: 150 }]}
                xAxis={[{ valueFormatter: (v: number) => num(v) }]}
                // Colour follows the brewery's own token, so a filter never repaints it.
                colors={breweries.map((b, i) => b.color ?? palette[i % palette.length])}
                margin={{ right: 16 }}
                hideLegend
              />
            </Box>
          </ChartCard>

          <ChartCard icon={<LocalOfferOutlinedIcon />} title="Podle typu">
            <Box sx={{ width: '100%', height: 240 }}>
              <PieChart
                series={[
                  {
                    innerRadius: 52,
                    outerRadius: 92,
                    paddingAngle: 1.5,
                    data: typeSlices.map((s, i) => ({ id: i, value: s.value, label: s.label, color: s.color })),
                    valueFormatter: (v) => fmtKg(v.value),
                  },
                ]}
              />
            </Box>
          </ChartCard>
        </Box>

        <ChartCard icon={<Inventory2OutlinedIcon />} title="Podle obalu" padded={false}>
          <DataTable
            columns={kindColumns}
            rows={kinds.map((k) => ({ kind: String(k.kind), units: k.units ?? 0, weightKg: k.weightKg ?? 0 }))}
            getRowKey={(r) => r.kind}
            dense
          />
        </ChartCard>
      </Stack>
    </>
  );
}

/** The prototype's four Objem KPIs (line 896). */
function KpiRow({
  total,
  clientsServed,
  kegUnits,
  bottleUnits,
  canUnits,
}: {
  total: number;
  clientsServed: number;
  kegUnits: number;
  bottleUnits: number;
  canUnits: number;
}) {
  return (
    <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
      <StatCard
        icon={<InsightsOutlinedIcon />}
        tone="amber"
        label="Celkem dodáno"
        value={fmtKg(total)}
        hint={`${num(clientsServed)} klientů obslouženo`}
      />
      <StatCard icon={<Inventory2OutlinedIcon />} tone="info" label="Sudy" value={fmtUnits(kegUnits)} />
      <StatCard icon={<Inventory2OutlinedIcon />} tone="grey" label="Lahve (basy)" value={fmtUnits(bottleUnits)} />
      <StatCard icon={<Inventory2OutlinedIcon />} tone="ok" label="Plechovky / multipack" value={fmtUnits(canUnits)} />
    </Box>
  );
}
```

> Two things to verify against the regenerated client before trusting this file:
> whether enum fields arrive as strings or numbers (the `kind` filters above accept
> both, matching `labels.ts`'s `enumName` approach), and whether `series[].bucketStart`
> is a `string` or a `Date` — `fmtDateShort` takes both, but the chart's x labels must
> read like the prototype's `20.7.`.

- [ ] **Step 9: Run the tests, typecheck and lint**

```bash
cd app && yarn vitest run src/features/reports/ && yarn typecheck && yarn lint
```

Expected: all report tests pass; no type or lint errors.

- [ ] **Step 10: Commit**

```bash
git add app/src/features/reports
git commit -m "feat(reports): Objem tab with a validated categorical palette

Replaces the prototype's TYPE_PALETTE, which fails colour-vision checks (two
near-grey hues; a protan pair at deltaE 3.0), cycles with % over 24 product
types, and assigned colour by rank so changing the period repainted every
slice. Colour now follows the entity. Layout and wording still match the
prototype exactly."
```

---

## Task 6: Klienti tab

**Files:**
- Create: `app/src/features/reports/ClientsTab.tsx`
- Test: `app/src/features/reports/ClientsTab.test.tsx`

**Interfaces:**
- Consumes: `ClientVolumeReportDto`; `ChartCard`; `useReportPalette`; `fmtKg`,
  `fmtUnits`, `sharePct`, `METRIC_OPTIONS`, `type ClientMetric` (Task 4/5);
  `regionLabel` from `src/lib/labels`; `PATHS.clients`.
- Produces: `<ClientsTab data />`.

Ported from the prototype's `repClients` (line 913): four KPIs, a top-10 bar chart with
a Hmotnost/Kusy toggle, a per-region bar chart, and a full clients table whose rows
navigate to the client detail.

**Top-clients colouring:** the prototype paints every top-client bar the same amber
(line 919). Keep that — a single-series bar chart needs no categorical hues, and per-bar
colour here would encode rank, which the palette rules forbid. One series ⇒ no legend
box needed; the card title names it.

- [ ] **Step 1: Write the failing test**

`app/src/features/reports/ClientsTab.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { theme } from 'src/theme/theme';
import { Region } from 'src/generated/api-client';
import { ClientsTab } from './ClientsTab';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useNavigate: () => navigate,
}));

const data = {
  clientsServed: 2,
  totalDeliveries: 7,
  totalWeightKg: 12400,
  topClients: [
    { clientId: 'c1', clientName: 'Hospoda U Kotvy', region: Region.ZittauCity, deliveries: 5, units: 200, weightKg: 9000 },
    { clientId: 'c2', clientName: 'Restaurace Na Rynku', region: Region.Leipzig, deliveries: 2, units: 120, weightKg: 3400 },
  ],
  byRegion: [
    { region: Region.ZittauCity, units: 200, weightKg: 9000 },
    { region: Region.Leipzig, units: 120, weightKg: 3400 },
  ],
} as never;

function renderTab(overrides: Record<string, unknown> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <ClientsTab data={{ ...(data as object), ...overrides } as never} />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('ClientsTab', () => {
  it('shows the four prototype KPIs including the average per client', () => {
    renderTab();

    expect(screen.getByText('Klientů obslouženo')).toBeInTheDocument();
    expect(screen.getByText('Rozvozů celkem')).toBeInTheDocument();
    expect(screen.getByText('Průměr na klienta')).toBeInTheDocument();
    // 12400 / 2 = 6200 kg => 6,2 t
    expect(screen.getByText('6,2 t')).toBeInTheDocument();
    expect(screen.getByText('Nejsilnější region')).toBeInTheDocument();
  });

  it('lists every client with region, deliveries and share', () => {
    renderTab();

    expect(screen.getByText('Hospoda U Kotvy')).toBeInTheDocument();
    expect(screen.getByText('Restaurace Na Rynku')).toBeInTheDocument();
    // 9000 / 12400 = 72,6 %
    expect(screen.getByText('72,6 %')).toBeInTheDocument();
  });

  it('navigates to the client detail when a table row is clicked', () => {
    renderTab();

    fireEvent.click(screen.getByText('Hospoda U Kotvy'));

    expect(navigate).toHaveBeenCalledWith('/clients/c1');
  });

  it('switches the top-clients metric between weight and units', () => {
    renderTab();

    fireEvent.click(screen.getByText('Kusy'));

    // The units figure appears once the metric flips.
    expect(screen.getByText('200 ks')).toBeInTheDocument();
  });

  it('shows an empty state and does not divide by zero with no clients', () => {
    renderTab({ clientsServed: 0, totalDeliveries: 0, totalWeightKg: 0, topClients: [], byRegion: [] });

    expect(screen.getByText('Za zvolené období nejsou žádná data.')).toBeInTheDocument();
    expect(screen.getByText('0 kg')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd app && yarn vitest run src/features/reports/ClientsTab.test.tsx
```

Expected: FAIL — cannot resolve `./ClientsTab`.

- [ ] **Step 3: Write the tab**

`app/src/features/reports/ClientsTab.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, Chip, Stack } from '@mui/material';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import { BarChart } from '@mui/x-charts/BarChart';
import { StatCard } from 'src/components/common/StatCard';
import { SegControl } from 'src/components/common/SegControl';
import { DataTable, type Column } from 'src/components/common/DataTable';
import { EmptyState } from 'src/components/common/EmptyState';
import { type ClientVolumeReportDto, type ClientVolumeRowDto } from 'src/generated/api-client';
import { num } from 'src/lib/format';
import { regionLabel } from 'src/lib/labels';
import { PATHS } from 'src/routes/paths';
import { ChartCard } from './ChartCard';
import { METRIC_OPTIONS, fmtKg, fmtUnits, sharePct, type ClientMetric } from './reportModel';
import { useReportPalette } from './reportPalette';

/**
 * Klienti — who took delivery and how much. Ported from the prototype's `repClients`
 * (line 913). The top-clients chart is one series in one colour on purpose: per-bar
 * hues would encode rank rather than identity.
 */
export function ClientsTab({ data }: { data: ClientVolumeReportDto }) {
  const navigate = useNavigate();
  const palette = useReportPalette();
  const [metric, setMetric] = useState<ClientMetric>('kg');

  const clients = data.topClients ?? [];
  const regions = data.byRegion ?? [];
  const total = data.totalWeightKg ?? 0;
  const served = data.clientsServed ?? 0;

  const averagePerClient = served > 0 ? total / served : 0;
  const strongestRegion = regions[0];

  const top = clients.slice(0, 10);
  const metricValue = (c: ClientVolumeRowDto) => (metric === 'kg' ? (c.weightKg ?? 0) : (c.units ?? 0));
  const metricFormat = (v: number) => (metric === 'kg' ? fmtKg(v) : fmtUnits(v));

  const columns: Column<ClientVolumeRowDto>[] = [
    { key: 'name', header: 'Klient', render: (r) => r.clientName },
    {
      key: 'region',
      header: 'Region',
      hideOnMobile: true,
      render: (r) => (
        <Chip
          size="small"
          variant="outlined"
          icon={<PlaceOutlinedIcon />}
          label={regionLabel(r.region) ?? '—'}
        />
      ),
    },
    { key: 'deliveries', header: 'Rozvozů', align: 'right', render: (r) => num(r.deliveries ?? 0) },
    { key: 'units', header: 'Kusů', align: 'right', render: (r) => num(r.units ?? 0) },
    { key: 'weight', header: 'Hmotnost', align: 'right', render: (r) => fmtKg(r.weightKg ?? 0) },
    { key: 'share', header: 'Podíl', align: 'right', render: (r) => sharePct(r.weightKg ?? 0, total) },
  ];

  return (
    <>
      <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <StatCard icon={<StorefrontOutlinedIcon />} tone="info" label="Klientů obslouženo" value={num(served)} />
        <StatCard
          icon={<LocalShippingOutlinedIcon />}
          tone="grey"
          label="Rozvozů celkem"
          value={num(data.totalDeliveries ?? 0)}
        />
        <StatCard
          icon={<InsightsOutlinedIcon />}
          tone="amber"
          label="Průměr na klienta"
          value={fmtKg(averagePerClient)}
        />
        <StatCard
          icon={<PlaceOutlinedIcon />}
          tone="ok"
          label="Nejsilnější region"
          value={strongestRegion ? (regionLabel(strongestRegion.region) ?? '—') : '—'}
          hint={strongestRegion ? fmtKg(strongestRegion.weightKg ?? 0) : undefined}
        />
      </Box>

      {clients.length === 0 ? (
        <Card sx={{ mt: 2 }}>
          <EmptyState title="Za zvolené období nejsou žádná data." />
        </Card>
      ) : (
        <Stack spacing={2} sx={{ mt: 2 }}>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1.25fr 1fr' }, alignItems: 'start' }}>
            <ChartCard
              icon={<StorefrontOutlinedIcon />}
              title="Nejlepší klienti"
              action={<SegControl value={metric} onChange={setMetric} options={METRIC_OPTIONS} />}
            >
              <Box sx={{ width: '100%', height: 40 + top.length * 40 }}>
                <BarChart
                  layout="horizontal"
                  series={[{ data: top.map(metricValue), valueFormatter: (v) => metricFormat(v ?? 0) }]}
                  yAxis={[{ scaleType: 'band', data: top.map((c) => c.clientName ?? '—'), width: 170 }]}
                  xAxis={[{ valueFormatter: (v: number) => num(v) }]}
                  colors={[palette[0]]}
                  margin={{ right: 16 }}
                  hideLegend
                />
              </Box>
            </ChartCard>

            <ChartCard icon={<MapOutlinedIcon />} title="Podle regionu">
              <Box sx={{ width: '100%', height: 40 + regions.length * 40 }}>
                <BarChart
                  layout="horizontal"
                  series={[{ data: regions.map((r) => r.weightKg ?? 0), valueFormatter: (v) => fmtKg(v ?? 0) }]}
                  yAxis={[{ scaleType: 'band', data: regions.map((r) => regionLabel(r.region) ?? '—'), width: 130 }]}
                  xAxis={[{ valueFormatter: (v: number) => num(v) }]}
                  colors={[palette[3]]}
                  margin={{ right: 16 }}
                  hideLegend
                />
              </Box>
            </ChartCard>
          </Box>

          <ChartCard icon={<StorefrontOutlinedIcon />} title="Všichni klienti" padded={false}>
            <DataTable
              columns={columns}
              rows={clients}
              getRowKey={(r) => String(r.clientId)}
              onRowClick={(r) => navigate(`${PATHS.clients}/${r.clientId}`)}
              dense
            />
          </ChartCard>
        </Stack>
      )}
    </>
  );
}
```

- [ ] **Step 4: Run it and watch it pass, then typecheck**

```bash
cd app && yarn vitest run src/features/reports/ClientsTab.test.tsx && yarn typecheck
```

Expected: PASS, 5 tests; no type errors.

- [ ] **Step 5: Commit**

```bash
git add app/src/features/reports/ClientsTab.tsx app/src/features/reports/ClientsTab.test.tsx
git commit -m "feat(reports): Klienti tab"
```

---

## Task 7: Provoz tab

**Files:**
- Create: `app/src/features/reports/OperationalTab.tsx`
- Test: `app/src/features/reports/OperationalTab.test.tsx`

**Interfaces:**
- Consumes: `OperationsReportDto`; `ChartCard`; `fmtKg`, `fmtUnits` (Task 4);
  `shipStateName`, `SHIP_STATUS` from `src/lib/labels`; `num` from `src/lib/format`.
- Produces: `<OperationalTab data />`.

Ported from the prototype's `repOps` (line 939): four KPIs, a shipments-by-state donut
with legend, an on-time gauge, an incoming-vs-outgoing grouped bar chart, and a
per-driver bar chart.

**Status colours are reserved.** The state donut and the gauge take their colours from
`SHIP_STATUS[...].tone` mapped onto the theme's status tokens — never from the
categorical palette. Each segment ships with a legend label, so state is never conveyed
by colour alone.

**One axis, two series.** `IncomingVsOutgoing` is two series in the same unit (kg) on a
single y-axis with a legend naming Dovoz and Vývoz. Never give the two sides their own
scales.

- [ ] **Step 1: Write the failing test**

`app/src/features/reports/OperationalTab.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { theme } from 'src/theme/theme';
import { OutgoingShipmentState } from 'src/generated/api-client';
import { OperationalTab } from './OperationalTab';

const data = {
  totalShipments: 20,
  totalStops: 34,
  onTimePercentage: 91,
  returnableUnits: 102,
  activeDrivers: 3,
  shipmentsByState: [
    { state: OutgoingShipmentState.Delivered, count: 17 },
    { state: OutgoingShipmentState.InTransit, count: 2 },
    { state: OutgoingShipmentState.Cancelled, count: 1 },
  ],
  incomingVsOutgoing: [
    { month: '2026-06-01', incomingWeightKg: 8000, outgoingWeightKg: 7400 },
    { month: '2026-07-01', incomingWeightKg: 9000, outgoingWeightKg: 12400 },
  ],
  byDriver: [
    { driverId: 'd1', driverName: 'Jan Novák', color: '#0072B2', deliveredShipments: 9 },
    { driverId: 'd2', driverName: 'Petr Malý', color: '#009E73', deliveredShipments: 8 },
  ],
} as never;

function renderTab(overrides: Record<string, unknown> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <OperationalTab data={{ ...(data as object), ...overrides } as never} />
    </ThemeProvider>
  );
}

describe('OperationalTab', () => {
  it('shows the four prototype KPIs with the stops hint', () => {
    renderTab();

    expect(screen.getByText('Vývozů celkem')).toBeInTheDocument();
    expect(screen.getByText('34 zastávek')).toBeInTheDocument();
    expect(screen.getByText('Doručeno včas')).toBeInTheDocument();
    expect(screen.getByText('91 %')).toBeInTheDocument();
    expect(screen.getByText('Vratných obalů')).toBeInTheDocument();
    expect(screen.getByText('102 ks')).toBeInTheDocument();
    expect(screen.getByText('Aktivních řidičů')).toBeInTheDocument();
  });

  it('labels every shipment state in the legend, so colour is never the only cue', () => {
    renderTab();

    expect(screen.getByText('Doručeno')).toBeInTheDocument();
    expect(screen.getByText('Na cestě')).toBeInTheDocument();
    expect(screen.getByText('Zrušeno')).toBeInTheDocument();
  });

  it('names both series of the incoming-vs-outgoing chart', () => {
    renderTab();

    expect(screen.getByText('Dovoz')).toBeInTheDocument();
    expect(screen.getByText('Vývoz')).toBeInTheDocument();
  });

  it('lists drivers with their delivered counts', () => {
    renderTab();

    expect(screen.getByText('Jan Novák')).toBeInTheDocument();
    expect(screen.getByText('Petr Malý')).toBeInTheDocument();
  });

  it('renders an empty state for a window with no shipments', () => {
    renderTab({
      totalShipments: 0, totalStops: 0, onTimePercentage: 0, returnableUnits: 0,
      activeDrivers: 0, shipmentsByState: [], incomingVsOutgoing: [], byDriver: [],
    });

    expect(screen.getByText('Za zvolené období nejsou žádná data.')).toBeInTheDocument();
    expect(screen.getByText('0 %')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd app && yarn vitest run src/features/reports/OperationalTab.test.tsx
```

Expected: FAIL — cannot resolve `./OperationalTab`.

- [ ] **Step 3: Write the tab**

`app/src/features/reports/OperationalTab.tsx`:

```tsx
import { Box, Card, Stack, Typography, useTheme } from '@mui/material';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import MoveToInboxOutlinedIcon from '@mui/icons-material/MoveToInboxOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { StatCard } from 'src/components/common/StatCard';
import { EmptyState } from 'src/components/common/EmptyState';
import { type OperationsReportDto } from 'src/generated/api-client';
import { num } from 'src/lib/format';
import { SHIP_STATUS, shipStateName, type StatusTone } from 'src/lib/labels';
import { ChartCard } from './ChartCard';
import { fmtKg, fmtUnits } from './reportModel';
import { useReportPalette } from './reportPalette';

/**
 * Provoz — how the operation ran. Ported from the prototype's `repOps` (line 939).
 * Shipment state and punctuality use the theme's reserved status colours, never the
 * categorical palette, and every segment carries a legend label.
 */
export function OperationalTab({ data }: { data: OperationsReportDto }) {
  const theme = useTheme();
  const palette = useReportPalette();

  const states = data.shipmentsByState ?? [];
  const months = data.incomingVsOutgoing ?? [];
  const drivers = data.byDriver ?? [];
  const onTime = Number(data.onTimePercentage ?? 0);

  // Reserved status tokens — the same ones StatusPill uses for shipment state.
  const toneColor: Record<StatusTone, string> = {
    amber: theme.vars.palette.warning.main,
    ok: theme.vars.palette.success.main,
    info: theme.vars.palette.info.main,
    crit: theme.vars.palette.error.main,
    grey: theme.vars.palette.text.secondary,
  };

  const stateSlices = states.map((s, i) => {
    const name = shipStateName(s.state) ?? String(s.state);
    const status = SHIP_STATUS[name];
    return {
      id: i,
      value: s.count ?? 0,
      label: status?.label ?? name,
      color: toneColor[status?.tone ?? 'grey'],
    };
  });

  const isEmpty =
    (data.totalShipments ?? 0) === 0 && states.length === 0 && months.length === 0 && drivers.length === 0;

  return (
    <>
      <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <StatCard
          icon={<LocalShippingOutlinedIcon />}
          tone="info"
          label="Vývozů celkem"
          value={num(data.totalShipments ?? 0)}
          hint={`${num(data.totalStops ?? 0)} zastávek`}
        />
        <StatCard
          icon={<CheckCircleOutlineIcon />}
          tone="ok"
          label="Doručeno včas"
          value={`${num(onTime)} %`}
          hint="vůči požadovanému termínu"
        />
        <StatCard
          icon={<MoveToInboxOutlinedIcon />}
          tone="amber"
          label="Vratných obalů"
          value={fmtUnits(data.returnableUnits ?? 0)}
          hint="prázdné obaly zpět"
        />
        <StatCard
          icon={<BadgeOutlinedIcon />}
          tone="grey"
          label="Aktivních řidičů"
          value={num(data.activeDrivers ?? 0)}
        />
      </Box>

      {isEmpty ? (
        <Card sx={{ mt: 2 }}>
          <EmptyState title="Za zvolené období nejsou žádná data." />
        </Card>
      ) : (
        <Stack spacing={2} sx={{ mt: 2 }}>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, alignItems: 'start' }}>
            <ChartCard icon={<LocalShippingOutlinedIcon />} title="Vývozy podle stavu">
              <Box sx={{ width: '100%', height: 240 }}>
                <PieChart
                  series={[
                    {
                      innerRadius: 52,
                      outerRadius: 92,
                      paddingAngle: 1.5,
                      data: stateSlices,
                      valueFormatter: (v) => `${num(v.value)} vývozů`,
                    },
                  ]}
                />
              </Box>
            </ChartCard>

            <ChartCard icon={<ScheduleOutlinedIcon />} title="Dodržení termínu">
              <Stack alignItems="center" justifyContent="center" sx={{ height: 240, position: 'relative' }}>
                <Box sx={{ width: 200, height: 200 }}>
                  <PieChart
                    series={[
                      {
                        innerRadius: 66,
                        outerRadius: 92,
                        startAngle: -90,
                        endAngle: 270,
                        data: [
                          { id: 0, value: onTime, label: 'Včas', color: theme.vars.palette.success.main },
                          { id: 1, value: Math.max(0, 100 - onTime), label: 'Pozdě', color: theme.vars.palette.brand.surface3 },
                        ],
                        valueFormatter: (v) => `${num(v.value)} %`,
                      },
                    ]}
                    hideLegend
                  />
                </Box>
                {/* The gauge's own readout — the KPI above states it in words too. */}
                <Box sx={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
                  <Typography sx={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{num(onTime)} %</Typography>
                  <Typography variant="caption" color="text.secondary">
                    včas
                  </Typography>
                </Box>
              </Stack>
            </ChartCard>
          </Box>

          <ChartCard icon={<MoveToInboxOutlinedIcon />} title="Dovoz vs. vývoz podle měsíce">
            <Box sx={{ width: '100%', height: 280 }}>
              {/* Both series are kilograms on ONE axis — never a second y-scale. */}
              <BarChart
                series={[
                  { data: months.map((m) => m.incomingWeightKg ?? 0), label: 'Dovoz', color: palette[3], valueFormatter: (v) => fmtKg(v ?? 0) },
                  { data: months.map((m) => m.outgoingWeightKg ?? 0), label: 'Vývoz', color: palette[0], valueFormatter: (v) => fmtKg(v ?? 0) },
                ]}
                xAxis={[{ scaleType: 'band', data: months.map((m) => monthLabel(m.month)), height: 28 }]}
                yAxis={[{ width: 56, valueFormatter: (v: number) => num(v) }]}
                margin={{ right: 16 }}
              />
            </Box>
          </ChartCard>

          <ChartCard icon={<BadgeOutlinedIcon />} title="Vývozy podle řidiče">
            <Box sx={{ width: '100%', height: 40 + drivers.length * 40 }}>
              <BarChart
                layout="horizontal"
                series={[{ data: drivers.map((d) => d.deliveredShipments ?? 0), valueFormatter: (v) => `${num(v ?? 0)} vývozů` }]}
                yAxis={[{ scaleType: 'band', data: drivers.map((d) => d.driverName ?? '—'), width: 150 }]}
                xAxis={[{ valueFormatter: (v: number) => num(v) }]}
                // The driver's own colour token: identity, not rank.
                colors={drivers.map((d, i) => d.color ?? palette[i % palette.length])}
                margin={{ right: 16 }}
                hideLegend
              />
            </Box>
          </ChartCard>
        </Stack>
      )}
    </>
  );
}

const MONTH_SHORT = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];

/** The prototype's short Czech month label (line 795). */
function monthLabel(month: string | Date | undefined): string {
  if (!month) return '—';
  const d = month instanceof Date ? month : new Date(month);
  return Number.isNaN(d.getTime()) ? '—' : MONTH_SHORT[d.getMonth()];
}
```

> `theme.vars.palette.brand.surface3` is the gauge's unfilled track, matching the
> prototype's `var(--surface-3)`. If `useTheme()` types `vars` as possibly undefined,
> use the non-null form the rest of the codebase uses in `sx` callbacks (`t.vars!`) —
> read `StatCard.tsx:58` for the established pattern.

- [ ] **Step 4: Run it and watch it pass, then the whole frontend gate**

```bash
cd app && yarn vitest run src/features/reports/ && yarn typecheck && yarn lint
```

Expected: every report test passes; no type or lint errors.

- [ ] **Step 5: Commit**

```bash
git add app/src/features/reports/OperationalTab.tsx app/src/features/reports/OperationalTab.test.tsx
git commit -m "feat(reports): Provoz tab

Shipment state and the on-time gauge use the theme's reserved status colours
with legend labels, so state is never conveyed by colour alone. Dovoz and
vývoz share one kilogram axis."
```

---

## Task 8: The page shell that ties the tabs together

**Files:**
- Create: `app/src/features/reports/ReportsPage.tsx`
- Test: `app/src/features/reports/ReportsPage.test.tsx`
- Modify: `app/src/routes/router.tsx` (only if Task 4 deferred the import/route)

**Interfaces:**
- Consumes: `useDeliveryVolume`, `useClientVolume`, `useOperationsReport` (Task 4);
  `periodRange`, `apiGranularity`, `PERIOD_LABEL`, `PERIOD_OPTIONS`, `TAB_OPTIONS`,
  `type ReportTab`, `type ReportPeriod`, `type VolumeGranularity` (Task 4);
  `<VolumeTab data granularity onGranularityChange>` (Task 5), `<ClientsTab data>`
  (Task 6), `<OperationalTab data>` (Task 7); `PageContainer`, `PageHeader`,
  `SegControl`, `QueryBoundary`.
- Produces: `<ReportsPage />` — the element for `PATHS.reports`.

This is the last piece: the three tabs are standalone components that take loaded data as
a prop, so they were built and tested before the shell existed. The shell adds the control
row, resolves the period preset to a date window, and keeps the two inactive tabs' queries
disabled so switching tabs is the only thing that fetches.

- [ ] **Step 1: Write the failing page test**

`app/src/features/reports/ReportsPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { theme } from 'src/theme/theme';
import { ReportsPage } from './ReportsPage';

const useDeliveryVolume = vi.fn();
const useClientVolume = vi.fn();
const useOperationsReport = vi.fn();

vi.mock('src/hooks/useReports', () => ({
  useDeliveryVolume: (...args: unknown[]) => useDeliveryVolume(...args),
  useClientVolume: (...args: unknown[]) => useClientVolume(...args),
  useOperationsReport: (...args: unknown[]) => useOperationsReport(...args),
}));

const loading = { data: undefined, isLoading: true, isError: false, error: null };
const empty = {
  data: {
    totalWeightKg: 0, totalUnits: 0, clientsServed: 0,
    unitsByKind: [], byBrewery: [], byType: [], series: [],
  },
  isLoading: false, isError: false, error: null,
};

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDeliveryVolume.mockReturnValue(empty);
    useClientVolume.mockReturnValue(loading);
    useOperationsReport.mockReturnValue(loading);
  });

  it('opens on Objem with the 90-day preset and only fetches the active tab', () => {
    renderPage();

    expect(screen.getByText('Reporty')).toBeInTheDocument();
    expect(screen.getByText('Objem')).toBeInTheDocument();

    // Active tab enabled, the other two disabled.
    expect(useDeliveryVolume.mock.calls[0][3]).toBe(true);
    expect(useClientVolume.mock.calls[0][2]).toBe(false);
    expect(useOperationsReport.mock.calls[0][2]).toBe(false);

    // 90 days is the default window: 90 days between from and to.
    const [from, to] = useDeliveryVolume.mock.calls[0] as [string, string];
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    expect(days).toBe(90);
  });

  it('refetches with a narrower window when the period preset changes', () => {
    renderPage();
    const before = useDeliveryVolume.mock.calls[0][0] as string;

    fireEvent.click(screen.getByText('30 dní'));

    const after = useDeliveryVolume.mock.calls.at(-1)![0] as string;
    expect(after).not.toBe(before);
    expect(Date.parse(after)).toBeGreaterThan(Date.parse(before));
  });

  it('switches the enabled query when a different tab is selected', () => {
    renderPage();

    fireEvent.click(screen.getByText('Klienti'));

    expect(useClientVolume.mock.calls.at(-1)![2]).toBe(true);
    expect(useDeliveryVolume.mock.calls.at(-1)![3]).toBe(false);
  });

  it('renders the error state instead of a tab body when the query fails', () => {
    useDeliveryVolume.mockReturnValue({
      data: undefined, isLoading: false, isError: true, error: new Error('boom'),
    });

    renderPage();

    expect(screen.getByText('Data se nepodařilo načíst.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd app && yarn vitest run src/features/reports/ReportsPage.test.tsx
```

Expected: FAIL — cannot resolve `./ReportsPage`.

- [ ] **Step 3: Write the page shell**

`app/src/features/reports/ReportsPage.tsx` — all three tab components already exist
(Tasks 5–7), so this wires them up for real. The shell owns the control row and the
fetching:

```tsx
import { useMemo, useState } from 'react';
import { Stack, Typography } from '@mui/material';
import { PageContainer, PageHeader } from 'src/components/common/PageHeader';
import { SegControl } from 'src/components/common/SegControl';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { useClientVolume, useDeliveryVolume, useOperationsReport } from 'src/hooks/useReports';
import { num } from 'src/lib/format';
import {
  PERIOD_LABEL, PERIOD_OPTIONS, TAB_OPTIONS, apiGranularity, periodRange,
  type ReportPeriod, type ReportTab, type VolumeGranularity,
} from './reportModel';
import { VolumeTab } from './VolumeTab';
import { ClientsTab } from './ClientsTab';
import { OperationalTab } from './OperationalTab';

/**
 * Reporty — one page, three tabs, a shared period preset. Only the active tab's query
 * runs; the other two stay disabled so switching tabs is the only thing that fetches.
 */
export function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('volume');
  const [period, setPeriod] = useState<ReportPeriod>('90');
  const [granularity, setGranularity] = useState<VolumeGranularity>('week');

  const { from, to } = useMemo(() => periodRange(period), [period]);

  const volume = useDeliveryVolume(from, to, apiGranularity(granularity), tab === 'volume');
  const clients = useClientVolume(from, to, tab === 'clients');
  const operations = useOperationsReport(from, to, tab === 'operational');

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Analýza"
        title="Reporty"
        subtitle={`Dokončené vývozy · ${PERIOD_LABEL[period]}.`}
      />

      <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <SegControl value={tab} onChange={setTab} options={TAB_OPTIONS} />
        <SegControl value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
      </Stack>

      {tab === 'volume' && (
        <QueryBoundary query={volume}>
          {(data) => (
            <VolumeTab
              data={data}
              granularity={granularity}
              onGranularityChange={setGranularity}
            />
          )}
        </QueryBoundary>
      )}

      {tab === 'clients' && (
        <QueryBoundary query={clients}>{(data) => <ClientsTab data={data} />}</QueryBoundary>
      )}

      {tab === 'operational' && (
        <QueryBoundary query={operations}>{(data) => <OperationalTab data={data} />}</QueryBoundary>
      )}
    </PageContainer>
  );
}
```

> Note the shape: the tab components take **loaded data as a plain prop** and never call
> a hook on possibly-missing data — the rule in `app/CLAUDE.md` under *Data fetching*.


- [ ] **Step 4: Run the tests, typecheck and lint**

```bash
cd app && yarn vitest run src/features/reports/ && yarn typecheck && yarn lint
```

Expected: every report test passes, including `ReportsPage.test.tsx` (4 tests). If Task 4
deferred the router import, add it now and re-run.

- [ ] **Step 5: Commit**

```bash
git add app/src/features/reports/ReportsPage.tsx app/src/features/reports/ReportsPage.test.tsx app/src/routes/router.tsx
git commit -m "feat(reports): Reporty page shell with the tab and period controls"
```

---

## Task 9: Look at it, update the spec, verify the whole thing

The validator checked colour, not layout. Nothing in Tasks 1–7 has actually been *seen*.

**Files:**
- Modify: `docs/superpowers/specs/2026-07-24-reporting-module-design.md`
- Modify: `app/CLAUDE.md` (one line about the report palette)

- [ ] **Step 1: Run the app and look at every tab in both colour schemes**

```bash
# terminal 1 — from api/AleTrack
ASPNETCORE_ENVIRONMENT=Development.Local dotnet run --project AleTrack --launch-profile Local
# terminal 2 — from app
yarn dev
```

Open `http://localhost:3039/reports` and check, in **both** light and dark:

- Objem / Klienti / Provoz each render; switching tabs refetches only that tab.
- All three period presets change the numbers.
- No axis label collisions; no chart overflowing its card; the page scrolls at the
  document level (no nested scrollbar) — the trap in `app/CLAUDE.md`.
- Donut legends are visible and labelled.
- Bar charts with long client names are readable (the y-axis `width` is generous enough).
- The nav shows **Analýza → Reporty** after the Sklad group.

Fix what you see before continuing. If a chart is unreadable at a narrow width, adjust
the `height`/`width` props — do not remove the legend.

- [ ] **Step 2: Verify the permission wiring end to end**

As an Admin, open Uživatelé → edit a user. The matrix must show a **Reporty** row.
Set it to *view*, save, reload, and confirm it persisted (this is what the `ModuleType.Reports`
addition in Task 4 exists for). Then set it to *none* and confirm the Reporty nav item
disappears for that user.

- [ ] **Step 3: Update the spec to match what was built**

In `docs/superpowers/specs/2026-07-24-reporting-module-design.md`, amend:

1. `DeliveryVolumeReportDto` — add `clientsServed`.
2. `OperationsReportDto` — add `totalShipments`, `totalStops`, `activeDrivers`; change
   `returnableUnits` from `OutgoingShipmentReturn.Quantity` to a note that returns hang
   off the shipment today and move to `Order` with `feat/order-returns`.
3. `ClientVolumeReportDto` — state that `deliveries` counts distinct shipment stops.
4. Frontend section — query keys are `qk.reportVolume` / `reportClients` /
   `reportOperations`, not `qk.reports.*`.
5. Add a short **Charting** note: `@mui/x-charts` v8, and that the categorical palette is
   the validated 7-slot Okabe-Ito-derived set rather than the prototype's `TYPE_PALETTE`,
   with the reason (CVD failures, cycling, rank-based assignment).
6. Add a **Backend constraint** note: `Product.Weight` is unmapped, so report handlers
   aggregate in memory, and mocked-DbContext tests cannot catch a violation.

- [ ] **Step 4: Add the palette rule to the frontend guide**

Append to `app/CLAUDE.md` under *Theme and MUI traps*:

```markdown
Chart colours for the Reporty module come from `src/features/reports/reportPalette.ts`,
whose light and dark arrays are validated for colour-vision deficiency and contrast
against the real card surfaces. Assign them by entity identity — never cycle with `%`
and never assign after sorting by value, or changing a filter repaints every series.
Status colours (shipment state, the on-time gauge) come from the theme's status tokens,
never from that palette.
```

- [ ] **Step 5: The full verification sweep — no filtered slices**

```bash
cd api/AleTrack && dotnet build AleTrack.sln && dotnet test AleTrack.Tests/AleTrack.Tests.csproj
cd ../../app && yarn test:run && yarn build && yarn lint
```

Expected: backend build 0 errors and **155 tests passing**; frontend **61 pre-existing +
~29 new tests passing**, `yarn build` (which runs `tsc --noEmit` then Vite) clean, lint clean.

Report the real numbers. If anything fails, fix it — do not report a filtered pass.

- [ ] **Step 6: Commit and open the PR**

```bash
git add docs/superpowers/specs/2026-07-24-reporting-module-design.md app/CLAUDE.md
git commit -m "docs(reports): reconcile the spec with the shipped module"
git push -u origin feat/reporting
gh pr create --base dev --title "Reporty — modul reportů (Objem, Klienti, Provoz)" --body "..."
```

The PR body should list: the three endpoints, the module registration including the
`ModuleType.Reports` addition, the in-memory aggregation rationale, the palette deviation
and why, the `PackageWeight.FiveKilos = 2` pre-existing oddity, and the
`feat/order-returns` interaction on `returnableUnits`.

---

## Self-Review

**1. Spec coverage.** Every section of `2026-07-24-reporting-module-design.md` maps to a
task: delivery-volume endpoint → Task 1; client-volume → Task 2; operations → Task 3;
module registration, nav, route, hooks, query keys, permissions → Task 4; the three tabs
and the charting library → Tasks 5–7; testing → the TDD steps throughout; docs
reconciliation → Task 8. The spec's deferred items (revenue/Tržby, export, custom ranges,
extra-item volume) stay out, as specced.

**2. Deliberate deviations, all recorded in commit messages and Task 9's spec update.**
- `clientsServed` added to the volume DTO (prototype KPI needs it).
- `totalShipments`, `totalStops`, `activeDrivers` added to the operations DTO (same reason).
- Query keys are `qk.reportVolume`-style siblings, because `qk.reports` is a flat array
  `useModuleCounts` depends on.
- The categorical palette replaces the prototype's `TYPE_PALETTE` on validated
  colour-vision grounds; layout and wording still match the prototype exactly.
- `ModuleType.Reports` added to the backend enum — not in the spec, but required, because
  the permission matrix is derived from the nav config.

**3. Known-uncertain points the implementer must verify rather than assume** (each is
flagged inline at the point of use, and none of them changes the plan's shape):
- The generated client's method names and argument order after `yarn generate-api`.
- Whether generated enum fields arrive as strings or numbers, and whether `bucketStart` /
  `month` are `string` or `Date`.
- `num()`'s exact `cs-CZ` output, which the expected test strings depend on.
- `ptypeLabel` wording for the two types used in `reportPalette.test.ts`'s ordering assertion.
- `DeliveryStop.Delivery` / `DeliveryStopKind` member names in Task 3's fixture helper.
- Whether `useTheme().vars` needs the `!` the rest of the codebase uses.

**4. Type consistency.** `DeliveredLineRow` gains `ClientPublicId` in Task 2 Step 1 and is
used in Task 2 Step 6 — same name both places. `ReportSeriesPointDto` is defined once, in
`Features/Reports/Utils/ReportWindow.cs`, and consumed by the volume DTO. `LineSpec`,
`DeliveredShipmentFixture` and the three `DeliveredShipmentBuilder` entry points
(`Build`, `AddSecondClient`, `WithIncomingDelivery`) keep consistent signatures across
Tasks 1–3. `fmtKg` / `fmtUnits` / `sharePct` are defined in `reportModel.ts` (Task 4) and
used unchanged in Tasks 5–7. `useReportPalette` returns `readonly string[]` and every
consumer indexes it numerically.

**5. Task independence.** Tasks 1–3 are backend-only and each ends with a green suite.
Task 4 is the only task that must run after all three (the client is generated from the
live Swagger doc). Tasks 5–7 build the three tabs as standalone components that take
loaded data as a prop, so each ends green on its own without a page to host it; Task 8
adds that page last. No task creates a placeholder component.
