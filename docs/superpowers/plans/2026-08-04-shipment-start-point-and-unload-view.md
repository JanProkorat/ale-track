# Shipment Start Point, Company Stop and Unload View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a planner say where a run starts, put the company warehouse on the route as a first-class stop that follows the stock purchases automatically, and give the driver a Vykládka tab listing what comes off the van at each stop in route order.

**Architecture:** The company address moves from a frontend env var into backend `appsettings.json`, and a new `GET outgoing-shipments/start-points` endpoint serves the company plus every brewery as pickable origins. A shipment stores its choice as `StartPointKind` + `StartBreweryId`. A third `OutgoingShipmentStopKind.Company` makes the warehouse stop identifiable, and the create/update endpoints keep exactly one of them present iff the run carries stock purchases. On the frontend, `DEPOT` is deleted and `RouteMap` takes explicit `start`/`end` props; the driver view is a pure shaping module plus a presentational list.

**Tech Stack:** .NET 10, FastEndpoints, EF Core + Npgsql, FluentValidation, xUnit + FluentAssertions + Moq.EntityFrameworkCore. React 19, Vite 6, TypeScript, MUI 7, TanStack Query 5, Vitest + Testing Library + happy-dom.

**Spec:** `docs/superpowers/specs/2026-08-04-shipment-start-point-and-unload-view-design.md`

## Global Constraints

- **Backend endpoints are `public sealed`**, inherit `Endpoint<TRequest, TResponse>`, and their `Configure()` uses `Description(b => b.RequirePermission(ModuleType.Shipments, PermissionLevel.X).Produces<T>(...).WithName(nameof(TheEndpoint)))` plus `DontCatchExceptions()` and a `Summary`. This repo does **not** use the `IFeatureConfiguration` / `_featureConfiguration` tag pattern — do not introduce it.
- **Options are bound in `Program.cs`**, next to the existing `services.Configure<JsonOptions>` and `services.Configure<HealthCheckServiceOptions>` calls.
- **Never edit `appsettings.Development*.json` or `appsettings.Production.json`** — they hold real secrets and are on a deny list. `appsettings.json` (the committed baseline) is fine.
- **`/// <summary>` on all public and internal members.** Multi-line form for anything non-trivial.
- **Guard clauses always use braces**, even single-statement ones.
- **All read-only EF queries use `AsNoTracking()`.** Prefer `.Select(...)` projections over loading whole entities.
- **The UI is Czech; the code is English.** Every user-visible string in Czech; comments, identifiers and commit messages in English. Never render a raw enum — map through `src/lib/labels.ts`.
- **`app/src/generated/api-client.ts` is generated and must never be hand-edited.** Regenerate with `yarn generate-api` against a locally running backend.
- **`@testing-library/user-event` is not a dependency.** Use `fireEvent`. MUI `Select` opens on `fireEvent.mouseDown`, not `click`.
- **Design tokens only** — `theme.vars.palette.*` inside `sx` callbacks, never `theme.palette.*` (under `cssVariables` the latter freezes to the light value).
- **Verification:** `dotnet-verify` for `api/**`, `react-verify` for `app/**`. Backend commands run from `api/AleTrack/`; frontend from `app/`.
- **Commit after every task.** Stage explicit paths — never `git add -A` or `git add .`; the working tree carries untracked scratch files and modified local config that must stay out.

## Working tree warning

The branch `feat/shipment-start-point-and-unload-view` has these **deliberately uncommitted** local files. Never stage them:

```
api/AleTrack/AleTrack/Program.cs                             (local ApplyMigrationsAsync toggle)
api/AleTrack/AleTrack/Properties/launchSettings.json
api/AleTrack/AleTrack/appsettings.Development.json           (real secrets)
api/AleTrack/AleTrack/appsettings.Development.Local.json     (real secrets)
d.txt  r.txt  r2.txt  docs/brewery-merch-catalog.{md,html}   (untracked scratch)
```

`Program.cs` is the awkward one: Task 1 legitimately modifies it, and it already carries an unrelated local edit (`await application.ApplyMigrationsAsync();` uncommented at line ~124). **Stage it with `git add -p`** and take only your `services.Configure<CompanyOptions>` hunk.

## File Structure

**Backend — created**

| Path | Responsibility |
|---|---|
| `Common/Enums/ShipmentStartPointKind.cs` | `Company = 0`, `Brewery = 1` |
| `Common/Options/CompanyOptions.cs` | The company address, bound from configuration |
| `Features/OutgoingShipments/Queries/StartPoints/ShipmentStartPointDto.cs` | One pickable origin |
| `Features/OutgoingShipments/Queries/StartPoints/GetShipmentStartPointsEndpoint.cs` | `GET outgoing-shipments/start-points` |
| `Features/OutgoingShipments/Utils/CompanyStopReconciler.cs` | The stock-purchase ⇄ Company-stop invariant |
| `Infrastructure/Persistence/Migrations/*_AddOutgoingShipmentStartPoint.cs` | Two columns + FK |

**Backend — modified**

| Path | Change |
|---|---|
| `Common/Enums/OutgoingShipmentStopKind.cs` | `+ Company = 2` |
| `Entities/OutgoingShipment.cs` | `+ StartPointKind`, `+ StartBreweryId`, `+ StartBrewery` |
| `Program.cs` | bind `CompanyOptions` |
| `Features/OutgoingShipments/Utils/CustomStopDto.cs` | `+ Kind` |
| `Features/OutgoingShipments/Queries/Detail/OutgoingShipmentDetailDto.cs` | `+` resolved start point |
| `Features/OutgoingShipments/Queries/Detail/GetOutgoingShipmentDetailEndpoint.cs` | project it |
| `Features/OutgoingShipments/Commands/Create/CreateOutgoingShipmentDto.cs` + endpoint | accept + persist start point, Company stops, reconcile |
| `Features/OutgoingShipments/Commands/Update/UpdateOutgoingShipmentDto.cs` + endpoint + validator | same, plus the frozen-field guard |
| `Features/OutgoingShipments/Utils/ShipmentContentGuard.cs` | kind-inclusive custom-stop diff, start point as frozen content |

**Frontend — created**

| Path | Responsibility |
|---|---|
| `src/features/shipments/unloadOrder.ts` | Pure: stops + stock purchases → `UnloadStop[]` |
| `src/features/shipments/unloadOrder.test.ts` | Its tests |
| `src/features/shipments/UnloadOrderList.tsx` | Presentational driver list |
| `src/features/shipments/StartPointPicker.tsx` | The editor's "Výchozí bod" card |

**Frontend — modified**

| Path | Change |
|---|---|
| `src/lib/geo.ts`, `geo.test.ts`, `vite-env.d.ts`, `env.example`, `vitest.config.ts` | delete `DEPOT` / `VITE_COMPANY_ADDRESS` |
| `src/components/common/RouteMap.tsx` | required `start` / `end` props |
| `src/components/common/CustomStopDialog.tsx` | company-address mode |
| `src/api/queryKeys.ts`, `src/hooks/useShipments.ts` | `shipmentStartPoints` key + hook |
| `src/features/shipments/ShipmentEditor.tsx` | start-point card, optimizer origin, save payload, Company stop rows |
| `src/features/shipments/ShipmentDetail.tsx` | Vykládka tab, map props |
| `src/generated/api-client.ts` | regenerated (never hand-edited) |

---

## Task 1: Company configuration and the start-points endpoint

**Files:**
- Create: `api/AleTrack/AleTrack/Common/Enums/ShipmentStartPointKind.cs`
- Create: `api/AleTrack/AleTrack/Common/Options/CompanyOptions.cs`
- Create: `api/AleTrack/AleTrack/Features/OutgoingShipments/Queries/StartPoints/ShipmentStartPointDto.cs`
- Create: `api/AleTrack/AleTrack/Features/OutgoingShipments/Queries/StartPoints/GetShipmentStartPointsEndpoint.cs`
- Modify: `api/AleTrack/AleTrack/appsettings.json`
- Modify: `api/AleTrack/AleTrack/Program.cs` (options binding only — stage with `git add -p`)
- Test: `api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/GetShipmentStartPointsTests.cs`

**Interfaces:**
- Consumes: nothing.
- Produces: `ShipmentStartPointKind { Company = 0, Brewery = 1 }`; `CompanyOptions` with `Name`, `StreetName`, `StreetNumber`, `City`, `Zip`, `Country`, `Latitude`, `Longitude` and a `FormatAddress()` returning `"<street> <number>, <zip> <city>"`; `ShipmentStartPointDto { Kind, BreweryId, Name, Address, Latitude, Longitude }`; route `GET outgoing-shipments/start-points`.

- [ ] **Step 1: Write the failing test**

`api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/GetShipmentStartPointsTests.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Common.Options;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Queries.StartPoints;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FastEndpoints;
using FluentAssertions;
using Microsoft.Extensions.Options;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// The pickable origins of a run: the company first, then the breweries in the
/// order the catalogue lists them.
/// </summary>
public sealed class GetShipmentStartPointsTests
{
    private static readonly CompanyOptions Company = new()
    {
        Name = "AleTrack s.r.o.",
        StreetName = "Nádražní",
        StreetNumber = "12",
        City = "Liberec",
        Zip = "46001",
        Country = Country.Czechia,
        Latitude = 50.7663m,
        Longitude = 15.0543m
    };

    [Fact]
    public async Task HandleAsync_CompanyAndBreweries_ReturnsCompanyFirstThenBreweriesByDisplayOrder()
    {
        var second = BreweryBuilder.BuildEntity(name: "Svijany", displayOrder: 2,
            officialAddress: AddressBuilder.BuildEntity(city: "Svijany", latitude: 50.5m, longitude: 15.0m));
        var first = BreweryBuilder.BuildEntity(name: "Rohozec", displayOrder: 1,
            officialAddress: AddressBuilder.BuildEntity(city: "Rohozec", latitude: 50.6m, longitude: 15.1m));

        var endpoint = CreateEndpoint([second, first]);

        await endpoint.HandleAsync(default);

        var result = endpoint.Response;
        result.Should().HaveCount(3);
        result[0].Kind.Should().Be(ShipmentStartPointKind.Company);
        result[0].BreweryId.Should().BeNull();
        result[0].Name.Should().Be("AleTrack s.r.o.");
        result[0].Address.Should().Be("Nádražní 12, 46001 Liberec");
        result[1].Kind.Should().Be(ShipmentStartPointKind.Brewery);
        result[1].Name.Should().Be("Rohozec");
        result[2].Name.Should().Be("Svijany");
    }

    /// <summary>
    /// A brewery whose address was never geocoded is still a legal choice — the map
    /// simply cannot plot it. Dropping it would hide a real option.
    /// </summary>
    [Fact]
    public async Task HandleAsync_BreweryWithoutCoordinates_IsStillListed()
    {
        var brewery = BreweryBuilder.BuildEntity(name: "Bez souřadnic", displayOrder: 1,
            officialAddress: AddressBuilder.BuildEntity(city: "Nikde", latitude: null, longitude: null));

        var endpoint = CreateEndpoint([brewery]);

        await endpoint.HandleAsync(default);

        endpoint.Response.Should().HaveCount(2);
        endpoint.Response[1].Name.Should().Be("Bez souřadnic");
        endpoint.Response[1].Latitude.Should().BeNull();
        endpoint.Response[1].Longitude.Should().BeNull();
    }

    private static GetShipmentStartPointsEndpoint CreateEndpoint(List<Brewery> breweries)
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock(breweries: breweries);

        // EndpointWithoutRequest<TResponse> derives from Endpoint<EmptyRequest, TResponse>,
        // not from the non-generic EndpointWithoutRequest, so the with-response builder is
        // the one whose constraint it satisfies.
        return EndpointWithResponseBuilder<EmptyRequest, List<ShipmentStartPointDto>, GetShipmentStartPointsEndpoint>
            .Create(dbContext.Object, Options.Create(Company));
    }
}
```

`BreweryBuilder.BuildEntity` / `AddressBuilder.BuildEntity` may not yet take `displayOrder` / `latitude` / `longitude` — check their signatures and add the optional parameters if missing rather than constructing entities inline.

- [ ] **Step 2: Run the test to verify it fails**

```bash
dotnet test api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~GetShipmentStartPointsTests"
```

Expected: compile error — `ShipmentStartPointKind`, `CompanyOptions` and `GetShipmentStartPointsEndpoint` do not exist.

- [ ] **Step 3: Add the enum and options**

`Common/Enums/ShipmentStartPointKind.cs`:

```csharp
namespace AleTrack.Common.Enums;

/// <summary>
/// Where a run is loaded before it sets off.
/// </summary>
public enum ShipmentStartPointKind
{
    /// <summary>The company's own warehouse — the historical default.</summary>
    Company = 0,

    /// <summary>A brewery, where the goods are picked up directly.</summary>
    Brewery = 1
}
```

`Common/Options/CompanyOptions.cs`:

```csharp
using AleTrack.Common.Enums;

namespace AleTrack.Common.Options;

/// <summary>
/// The company's own address, bound from the <c>Company</c> configuration section.
/// </summary>
/// <remarks>
/// Single source of truth for three things that used to read a frontend env var:
/// the start-point picker, the coordinates of a
/// <see cref="OutgoingShipmentStopKind.Company"/> stop, and the end of every route.
/// </remarks>
public sealed class CompanyOptions
{
    /// <summary>Configuration section this binds to.</summary>
    public const string SectionName = "Company";

    /// <summary>Display name of the company.</summary>
    public string Name { get; set; } = null!;

    /// <summary>Street the warehouse is on.</summary>
    public string StreetName { get; set; } = null!;

    /// <summary>Street number of the warehouse.</summary>
    public string StreetNumber { get; set; } = null!;

    /// <summary>City the warehouse is in.</summary>
    public string City { get; set; } = null!;

    /// <summary>Postal code of the warehouse.</summary>
    public string Zip { get; set; } = null!;

    /// <summary>Country the warehouse is in.</summary>
    public Country Country { get; set; }

    /// <summary>Latitude of the warehouse.</summary>
    public decimal Latitude { get; set; }

    /// <summary>Longitude of the warehouse.</summary>
    public decimal Longitude { get; set; }

    /// <summary>
    /// The address on one line, in the Czech postal order used everywhere in the UI.
    /// </summary>
    public string FormatAddress() => $"{StreetName} {StreetNumber}, {Zip} {City}";
}
```

- [ ] **Step 4: Add configuration and bind it**

In `api/AleTrack/AleTrack/appsettings.json`, add a top-level section (real address, not a secret):

```json
"Company": {
  "Name": "AleTrack s.r.o.",
  "StreetName": "Nádražní",
  "StreetNumber": "12",
  "City": "Liberec",
  "Zip": "46001",
  "Country": "Czechia",
  "Latitude": 50.7663,
  "Longitude": 15.0543
}
```

In `Program.cs`, beside the existing `services.Configure<JsonOptions>(...)` call:

```csharp
services.Configure<CompanyOptions>(configuration.GetSection(CompanyOptions.SectionName));
```

Match the surrounding code's name for the configuration object — read the enclosing method rather than assuming `configuration`.

- [ ] **Step 5: Add the DTO and endpoint**

`Features/OutgoingShipments/Queries/StartPoints/ShipmentStartPointDto.cs`:

```csharp
using AleTrack.Common.Enums;

namespace AleTrack.Features.OutgoingShipments.Queries.StartPoints;

/// <summary>
/// One place a run may be loaded at: the company warehouse, or a brewery.
/// </summary>
public sealed record ShipmentStartPointDto
{
    /// <summary>Which kind of origin this is.</summary>
    public ShipmentStartPointKind Kind { get; set; }

    /// <summary>Public ID of the brewery; null for the company entry.</summary>
    public Guid? BreweryId { get; set; }

    /// <summary>Display name — the company name or the brewery name.</summary>
    public string Name { get; set; } = null!;

    /// <summary>The address on one line.</summary>
    public string Address { get; set; } = null!;

    /// <summary>Latitude, when the address has been geocoded.</summary>
    public decimal? Latitude { get; set; }

    /// <summary>Longitude, when the address has been geocoded.</summary>
    public decimal? Longitude { get; set; }
}
```

`Features/OutgoingShipments/Queries/StartPoints/GetShipmentStartPointsEndpoint.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Common.Options;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AleTrack.Features.OutgoingShipments.Queries.StartPoints;

/// <summary>
/// Endpoint returning every place a run may start from: the company warehouse
/// first, then the breweries.
/// </summary>
/// <param name="dbContext"></param>
/// <param name="companyOptions"></param>
public sealed class GetShipmentStartPointsEndpoint(
    AleTrackDbContext dbContext,
    IOptions<CompanyOptions> companyOptions)
    : EndpointWithoutRequest<List<ShipmentStartPointDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("outgoing-shipments/start-points");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.View)
            .Produces<List<ShipmentStartPointDto>>(StatusCodes.Status200OK)
            .WithName(nameof(GetShipmentStartPointsEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Retrieves the places an outgoing shipment may start from";
            s.Responses[StatusCodes.Status200OK] = "Start points retrieved";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var company = companyOptions.Value;

        // Ordered by the brewery's own display order — the same key the catalogue
        // and the loading list sort by, so the picker reads in a familiar order.
        var breweries = await dbContext.Breweries
            .AsNoTracking()
            .OrderBy(b => b.DisplayOrder)
            .ThenBy(b => b.Name)
            .Select(b => new ShipmentStartPointDto
            {
                Kind = ShipmentStartPointKind.Brewery,
                BreweryId = b.PublicId,
                Name = b.Name,
                Address = b.OfficialAddress.StreetName + " " + b.OfficialAddress.StreetNumber
                    + ", " + b.OfficialAddress.Zip + " " + b.OfficialAddress.City,
                Latitude = b.OfficialAddress.Latitude,
                Longitude = b.OfficialAddress.Longitude
            })
            .ToListAsync(ct);

        List<ShipmentStartPointDto> startPoints =
        [
            new()
            {
                Kind = ShipmentStartPointKind.Company,
                BreweryId = null,
                Name = company.Name,
                Address = company.FormatAddress(),
                Latitude = company.Latitude,
                Longitude = company.Longitude
            },
            .. breweries
        ];

        await Send.OkAsync(startPoints, ct);
    }
}
```

The address is concatenated inside the projection rather than calling a helper, because EF must translate it to SQL. Check `Brewery.OfficialAddress`'s actual property names against `Entities/Address.cs` before writing this.

- [ ] **Step 6: Run the test to verify it passes**

```bash
dotnet test api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~GetShipmentStartPointsTests"
```

Expected: 2 passed.

- [ ] **Step 7: Run the full backend suite**

```bash
dotnet test api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj
```

Expected: all green. A filtered run is not enough — this repo has had pre-existing failures a scoped run missed.

- [ ] **Step 8: Commit**

```bash
git add api/AleTrack/AleTrack/Common/Enums/ShipmentStartPointKind.cs \
        api/AleTrack/AleTrack/Common/Options/CompanyOptions.cs \
        api/AleTrack/AleTrack/Features/OutgoingShipments/Queries/StartPoints/ \
        api/AleTrack/AleTrack/appsettings.json \
        api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/GetShipmentStartPointsTests.cs
git add -p api/AleTrack/AleTrack/Program.cs   # take ONLY the CompanyOptions hunk
git commit -m "feat: serve the places a run can start from"
```

---

## Task 2: Persist the start point on the shipment

**Files:**
- Modify: `api/AleTrack/AleTrack/Entities/OutgoingShipment.cs`
- Create: `api/AleTrack/AleTrack/Infrastructure/Persistence/Migrations/*_AddOutgoingShipmentStartPoint.cs` (generated)
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Queries/Detail/OutgoingShipmentDetailDto.cs`
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Queries/Detail/GetOutgoingShipmentDetailEndpoint.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/GetOutgoingShipmentDetailStartPointTests.cs`

**Interfaces:**
- Consumes: `ShipmentStartPointKind`, `CompanyOptions` (Task 1).
- Produces: `OutgoingShipment.StartPointKind`, `.StartBreweryId`, `.StartBrewery`; on `OutgoingShipmentDetailDto` — `StartPointKind`, `StartBreweryId`, `StartPointName`, `StartPointAddress`, `StartPointLatitude`, `StartPointLongitude`.

- [ ] **Step 1: Write the failing test**

`api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/GetOutgoingShipmentDetailStartPointTests.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Common.Options;
using AleTrack.Tests.Builders;
using FluentAssertions;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// The detail response resolves the start point so the map needs no second request.
/// </summary>
public sealed class GetOutgoingShipmentDetailStartPointTests
{
    [Fact]
    public async Task HandleAsync_StartPointIsCompany_ReturnsCompanyAddress()
    {
        var shipment = OutgoingShipmentBuilder.BuildEntity();
        shipment.StartPointKind = ShipmentStartPointKind.Company;
        shipment.StartBreweryId = null;

        var response = await DetailOf(shipment);

        response.StartPointKind.Should().Be(ShipmentStartPointKind.Company);
        response.StartBreweryId.Should().BeNull();
        response.StartPointName.Should().Be("AleTrack s.r.o.");
        response.StartPointLatitude.Should().Be(50.7663m);
    }

    [Fact]
    public async Task HandleAsync_StartPointIsBrewery_ReturnsBreweryNameAndCoordinates()
    {
        var brewery = BreweryBuilder.BuildEntity(name: "Svijany",
            officialAddress: AddressBuilder.BuildEntity(city: "Svijany", latitude: 50.5m, longitude: 15.0m));
        var shipment = OutgoingShipmentBuilder.BuildEntity();
        shipment.StartPointKind = ShipmentStartPointKind.Brewery;
        shipment.StartBrewery = brewery;
        shipment.StartBreweryId = brewery.Id;

        var response = await DetailOf(shipment, [brewery]);

        response.StartPointKind.Should().Be(ShipmentStartPointKind.Brewery);
        response.StartBreweryId.Should().Be(brewery.PublicId);
        response.StartPointName.Should().Be("Svijany");
        response.StartPointLatitude.Should().Be(50.5m);
    }

    /// <summary>
    /// Every run that predates this feature reads as starting at the company —
    /// exactly what the hardcoded depot used to mean.
    /// </summary>
    [Fact]
    public async Task HandleAsync_ShipmentPredatingTheFeature_DefaultsToCompany()
    {
        var response = await DetailOf(OutgoingShipmentBuilder.BuildEntity());

        response.StartPointKind.Should().Be(ShipmentStartPointKind.Company);
    }
}
```

Write the `DetailOf` helper against `GetOutgoingShipmentDetailEndpoint`'s real construction — copy the arrangement from the existing `GetOutgoingShipmentDetailBreweryTests.cs`, adding `Options.Create(new CompanyOptions { ... })` for the new constructor parameter.

- [ ] **Step 2: Run the test to verify it fails**

```bash
dotnet test api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~GetOutgoingShipmentDetailStartPointTests"
```

Expected: compile error — `StartPointKind` is not a member of `OutgoingShipment`.

- [ ] **Step 3: Add the entity fields**

In `Entities/OutgoingShipment.cs`, after `DeliveryDate`:

```csharp
/// <summary>
/// Where the run is loaded before it sets off.
/// </summary>
/// <remarks>
/// Runs created before this existed default to
/// <see cref="ShipmentStartPointKind.Company"/>, which is exactly what the
/// hardcoded depot origin used to mean.
/// </remarks>
[Column("start_point_kind")]
public ShipmentStartPointKind StartPointKind { get; set; } = ShipmentStartPointKind.Company;

/// <summary>
/// The brewery the run is loaded at. Set only when
/// <see cref="StartPointKind"/> is <see cref="ShipmentStartPointKind.Brewery"/>.
/// </summary>
[Column("start_brewery_id")]
public long? StartBreweryId { get; set; }

/// <summary>
/// Brewery the run starts at. Restricted rather than cascaded: deleting a brewery
/// a planned run loads at should fail loudly, not delete the run.
/// </summary>
[DeleteBehavior(DeleteBehavior.Restrict)]
public Brewery? StartBrewery { get; set; }
```

- [ ] **Step 4: Generate the migration**

```bash
cd api/AleTrack/AleTrack
dotnet ef migrations add AddOutgoingShipmentStartPoint
```

- [ ] **Step 5: Review the generated SQL before going further**

Open the new migration. Confirm three things and fix by hand if not:

1. `start_point_kind` is added as a **string** column (the DbContext converts enums to strings globally) with a non-null default of `'Company'` — existing rows must not become invalid.
2. `start_brewery_id` is nullable, with a `ReferentialAction.Restrict` FK to `breweries` and an index on the column.
3. **No destructive operations** — no `DropColumn`, no drop-and-recreate of `outgoing_shipments`. If any appear, stop and diagnose rather than applying.

- [ ] **Step 6: Expose the start point on the detail DTO**

Add to `OutgoingShipmentDetailDto`:

```csharp
/// <summary>Which kind of place the run is loaded at.</summary>
public ShipmentStartPointKind StartPointKind { get; set; }

/// <summary>Public ID of the start brewery; null when the run starts at the company.</summary>
public Guid? StartBreweryId { get; set; }

/// <summary>Resolved display name of the start point.</summary>
public string StartPointName { get; set; } = null!;

/// <summary>Resolved one-line address of the start point.</summary>
public string StartPointAddress { get; set; } = null!;

/// <summary>Latitude of the start point, when known.</summary>
public decimal? StartPointLatitude { get; set; }

/// <summary>Longitude of the start point, when known.</summary>
public decimal? StartPointLongitude { get; set; }
```

- [ ] **Step 7: Project it in the detail endpoint**

Inject `IOptions<CompanyOptions> companyOptions` into `GetOutgoingShipmentDetailEndpoint`'s primary constructor, add `.Include(os => os.StartBrewery)` (or the projection equivalent) to the query, and fill the six fields. A brewery start point whose brewery row is somehow missing falls back to the company — the map must always have an origin:

```csharp
StartPointKind = os.StartPointKind,
StartBreweryId = os.StartBrewery != null ? os.StartBrewery.PublicId : null,
StartPointName = os.StartBrewery != null ? os.StartBrewery.Name : company.Name,
StartPointAddress = os.StartBrewery != null
    ? os.StartBrewery.OfficialAddress.StreetName + " " + os.StartBrewery.OfficialAddress.StreetNumber
        + ", " + os.StartBrewery.OfficialAddress.Zip + " " + os.StartBrewery.OfficialAddress.City
    : companyAddress,
StartPointLatitude = os.StartBrewery != null ? os.StartBrewery.OfficialAddress.Latitude : company.Latitude,
StartPointLongitude = os.StartBrewery != null ? os.StartBrewery.OfficialAddress.Longitude : company.Longitude,
```

Hoist `var company = companyOptions.Value;` and `var companyAddress = company.FormatAddress();` above the query — a method call inside an EF projection will not translate.

- [ ] **Step 8: Run the tests to verify they pass**

```bash
dotnet test api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~GetOutgoingShipmentDetailStartPointTests"
dotnet test api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj
```

Expected: 3 passed, then the whole suite green.

- [ ] **Step 9: Commit**

```bash
git add api/AleTrack/AleTrack/Entities/OutgoingShipment.cs \
        api/AleTrack/AleTrack/Infrastructure/Persistence/Migrations/ \
        api/AleTrack/AleTrack/Features/OutgoingShipments/Queries/Detail/ \
        api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/GetOutgoingShipmentDetailStartPointTests.cs
git commit -m "feat: store and resolve an outgoing shipment's start point"
```

---

## Task 3: Accept the start point on create and update

**Files:**
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Commands/Create/CreateOutgoingShipmentDto.cs` and its endpoint
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Commands/Update/UpdateOutgoingShipmentDto.cs`, its endpoint and `UpdateOutgoingShipmentValidator.cs`
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Utils/ShipmentContentGuard.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentStartPointWriteTests.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentContentGuardTests.cs` (extend)

**Interfaces:**
- Consumes: `ShipmentStartPointKind`, `OutgoingShipment.StartPointKind` / `.StartBreweryId` (Tasks 1–2).
- Produces: `StartPointKind` + `StartBreweryId` on both write DTOs; `ShipmentContentGuard.ChangedFrozenFields` additionally reports `nameof(incoming.StartPointKind)` / `nameof(incoming.StartBreweryId)`.

- [ ] **Step 1: Write the failing tests**

`ShipmentStartPointWriteTests.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Tests.Builders;
using FluentAssertions;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// Writing a start point: what persists, what is rejected, and when it freezes.
/// </summary>
public sealed class ShipmentStartPointWriteTests
{
    [Fact]
    public async Task HandleAsync_StartPointIsBrewery_PersistsTheBrewery()
    {
        var brewery = BreweryBuilder.BuildEntity(name: "Svijany");
        var (shipment, request, dbContext) = Arrange(OutgoingShipmentState.Created, [brewery]);

        request.Data.StartPointKind = ShipmentStartPointKind.Brewery;
        request.Data.StartBreweryId = brewery.PublicId;

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>
            .Create(dbContext.Object, Options.Create(Company));

        await endpoint.HandleAsync(request, CancellationToken.None);

        shipment.StartPointKind.Should().Be(ShipmentStartPointKind.Brewery);
        shipment.StartBrewery.Should().Be(brewery);
    }

    [Fact]
    public async Task HandleAsync_UnknownStartBreweryId_Returns404()
    {
        var (_, request, dbContext) = Arrange(OutgoingShipmentState.Created, []);

        request.Data.StartPointKind = ShipmentStartPointKind.Brewery;
        request.Data.StartBreweryId = Guid.NewGuid();

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>
            .Create(dbContext.Object, Options.Create(Company));

        var act = async () => await endpoint.HandleAsync(request, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task HandleAsync_StartPointChangedOnLoadedShipment_IsRejectedAsFrozenContent()
    {
        var brewery = BreweryBuilder.BuildEntity(name: "Svijany");
        var (_, request, dbContext) = Arrange(OutgoingShipmentState.Loaded, [brewery]);

        request.Data.State = OutgoingShipmentState.Loaded;
        request.Data.StartPointKind = ShipmentStartPointKind.Brewery;
        request.Data.StartBreweryId = brewery.PublicId;

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>
            .Create(dbContext.Object, Options.Create(Company));

        var act = async () => await endpoint.HandleAsync(request, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.ShipmentContentFrozen);
    }

    [Fact]
    public void Validate_StartPointKindCompanyWithBreweryId_FailsValidation()
    {
        var dto = OutgoingShipmentBuilder.BuildUpdateDto();
        dto.StartPointKind = ShipmentStartPointKind.Company;
        dto.StartBreweryId = Guid.NewGuid();

        var result = new UpdateOutgoingShipmentDtoValidator().TestValidate(dto);

        result.ShouldHaveValidationErrorFor(d => d.StartBreweryId);
    }

    [Fact]
    public void Validate_StartPointKindBreweryWithoutBreweryId_FailsValidation()
    {
        var dto = OutgoingShipmentBuilder.BuildUpdateDto();
        dto.StartPointKind = ShipmentStartPointKind.Brewery;
        dto.StartBreweryId = null;

        var result = new UpdateOutgoingShipmentDtoValidator().TestValidate(dto);

        result.ShouldHaveValidationErrorFor(d => d.StartBreweryId);
    }

    private static readonly CompanyOptions Company = new()
    {
        Name = "AleTrack s.r.o.",
        StreetName = "Nádražní",
        StreetNumber = "12",
        City = "Liberec",
        Zip = "46001",
        Country = Country.Czechia,
        Latitude = 50.7663m,
        Longitude = 15.0543m
    };

    /// <summary>
    /// A shipment in the given state with one order stop, plus a PUT that round-trips
    /// it unchanged — so each test changes exactly the one thing it is about.
    /// </summary>
    private static (OutgoingShipment Shipment, UpdateOutgoingShipmentRequest Request, Mock<AleTrackDbContext> DbContext)
        Arrange(OutgoingShipmentState state, List<Brewery> breweries)
    {
        var shipmentId = Guid.NewGuid();
        var orderId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(publicId: orderId, client: client);

        var shipment = OutgoingShipmentBuilder.BuildEntity(publicId: shipmentId, state: state);
        shipment.Stops.Add(new OutgoingShipmentStop
        {
            Kind = OutgoingShipmentStopKind.Order,
            ClientOrder = order,
            Order = 1
        });

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            outgoingShipments: [shipment],
            orders: [order],
            breweries: breweries);

        var request = new UpdateOutgoingShipmentRequest
        {
            Id = shipmentId,
            Data = OutgoingShipmentBuilder.BuildUpdateDto(
                clientOrderShipments: [new ClientOrderShipmentDto { ClientOrderId = orderId, Order = 1 }],
                state: state)
        };

        return (shipment, request, dbContext);
    }
}
```

`Arrange` returns the shipment so a test can assert against the mutated entity, which is how `UpdateOutgoingShipmentTests` verifies writes — the endpoint returns `204 No Content`, so there is no response body to inspect.

Add to `ShipmentContentGuardTests.cs`:

```csharp
[Fact]
public void ChangedFrozenFields_StartPointChanged_ReportsStartPointKind()
{
    var (shipment, dto) = RoundTripped();

    dto.StartPointKind = ShipmentStartPointKind.Brewery;
    dto.StartBreweryId = Guid.NewGuid();

    ShipmentContentGuard.ChangedFrozenFields(shipment, dto)
        .Should().Contain(nameof(UpdateOutgoingShipmentDto.StartPointKind));
}
```

`RoundTripped()` must be extended to copy the start point across, or the unchanged-request test will start failing.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
dotnet test api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentStartPointWriteTests"
```

Expected: compile error — `StartPointKind` is not a member of the write DTOs.

- [ ] **Step 3: Add the DTO fields**

To both `CreateOutgoingShipmentDto` and `UpdateOutgoingShipmentDto`:

```csharp
/// <summary>
/// Where the run is loaded before it sets off. Defaults to the company warehouse.
/// </summary>
public ShipmentStartPointKind StartPointKind { get; set; } = ShipmentStartPointKind.Company;

/// <summary>
/// Public ID of the brewery the run starts at. Required when
/// <see cref="StartPointKind"/> is <see cref="ShipmentStartPointKind.Brewery"/>,
/// and must be null otherwise.
/// </summary>
public Guid? StartBreweryId { get; set; }
```

- [ ] **Step 4: Add the validation rules**

In `UpdateOutgoingShipmentDtoValidator` (and the matching create validator):

```csharp
RuleFor(dto => dto.StartPointKind)
    .IsInEnum()
    .WithErrorCode(ErrorCodes.ValidationEnumError);

RuleFor(dto => dto.StartBreweryId)
    .NotNull()
    .When(dto => dto.StartPointKind == ShipmentStartPointKind.Brewery)
    .WithErrorCode(ErrorCodes.ValidationNotNullError);

RuleFor(dto => dto.StartBreweryId)
    .Null()
    .When(dto => dto.StartPointKind == ShipmentStartPointKind.Company)
    .WithErrorCode(ErrorCodes.ValidationNotNullError);
```

- [ ] **Step 5: Resolve and persist it in both endpoints**

Add a private helper to each endpoint, following the shape of the existing `GetVehicleAsync`:

```csharp
/// <summary>
/// Resolves the brewery a run starts at, or null when it starts at the company.
/// </summary>
private async Task<Brewery?> GetStartBreweryAsync(
    ShipmentStartPointKind kind, Guid? breweryId, CancellationToken ct)
{
    if (kind != ShipmentStartPointKind.Brewery || breweryId is null)
    {
        return null;
    }

    var brewery = await dbContext.Breweries
        .FirstOrDefaultAsync(b => b.PublicId == breweryId, ct);

    if (brewery is null)
    {
        ThrowHelper.PublicEntityNotFound(nameof(Brewery), breweryId.Value);
    }

    return brewery;
}
```

Then assign alongside the other scalar writes:

```csharp
outgoingShipment.StartPointKind = req.Data.StartPointKind;
outgoingShipment.StartBrewery = await GetStartBreweryAsync(req.Data.StartPointKind, req.Data.StartBreweryId, ct);
outgoingShipment.StartBreweryId = outgoingShipment.StartBrewery?.Id;
```

In the update endpoint this must come **after** the `ShipmentContentGuard` check, like every other mutation there — the guard compares stored against incoming and mutating first would make the comparison compare the request with itself.

- [ ] **Step 6: Extend the frozen-content guard**

In `ShipmentContentGuard.ChangedFrozenFields`, before the `return`:

```csharp
if (stored.StartPointKind != incoming.StartPointKind
    || stored.StartBrewery?.PublicId != incoming.StartBreweryId)
{
    changed.Add(nameof(incoming.StartPointKind));
}
```

The stored side reads `StartBrewery?.PublicId`, so the update endpoint's query needs `.Include(os => os.StartBrewery)` — without it every save of a brewery-started shipment reads the brewery as removed and is rejected. Add the include.

- [ ] **Step 7: Run the tests to verify they pass**

```bash
dotnet test api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentStartPoint"
dotnet test api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentContentGuardTests"
dotnet test api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj
```

Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add api/AleTrack/AleTrack/Features/OutgoingShipments/ \
        api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/
git commit -m "feat: accept a start point when creating and updating a run"
```

---

## Task 4: The Company stop kind

**Files:**
- Modify: `api/AleTrack/AleTrack/Common/Enums/OutgoingShipmentStopKind.cs`
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Utils/CustomStopDto.cs`
- Modify: create and update endpoints (`BuildCustomStops` and the create projection)
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Utils/ShipmentContentGuard.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/CompanyStopTests.cs`

**Interfaces:**
- Consumes: `CompanyOptions` (Task 1).
- Produces: `OutgoingShipmentStopKind.Company = 2`; `CustomStopDto.Kind` defaulting to `Custom`. A Company stop's `Label`, `Latitude` and `Longitude` are **server-authored** from `CompanyOptions`, never taken from the request.

> **This task carries the trap.** `ShipmentContentGuard.CustomStopsMatch` compares stored stops filtered to `Kind == Custom` against **all** of `incoming.CustomStops`. The moment a Company stop exists it is stored as `Company` but sent in the `CustomStops` list, so the two sides differ and every save of a non-`Created` shipment is rejected as frozen content. The filter must widen to both kinds and `Kind` must join the compared tuple.

- [ ] **Step 1: Write the failing tests**

`CompanyStopTests.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Features.OutgoingShipments.Commands.Update;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Tests.Builders;
using FluentAssertions;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// The warehouse stop: server-authored coordinates, and a content diff that can
/// actually see it.
/// </summary>
public sealed class CompanyStopTests
{
    /// <summary>
    /// The label and coordinates are the server's to write. A stale — or hostile —
    /// client must not be able to pin the warehouse stop somewhere else.
    /// </summary>
    [Fact]
    public async Task HandleAsync_CompanyStopInRequest_PersistsCompanyAddressNotTheClientsClaim()
    {
        var (shipment, request, dbContext) = Arrange(OutgoingShipmentState.Created, []);

        request.Data.CustomStops =
        [
            new CustomStopDto
            {
                Kind = OutgoingShipmentStopKind.Company,
                Order = 2,
                Label = "Někde jinde",
                Latitude = 0m,
                Longitude = 0m
            }
        ];

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>
            .Create(dbContext.Object, Options.Create(Company));

        await endpoint.HandleAsync(request, CancellationToken.None);

        var stored = shipment.Stops.Single(s => s.Kind == OutgoingShipmentStopKind.Company);
        stored.Label.Should().Be("AleTrack s.r.o.");
        stored.Latitude.Should().Be(50.7663m);
        stored.Longitude.Should().Be(15.0543m);
    }

    [Fact]
    public async Task HandleAsync_TwoCompanyStops_FailsValidation()
    {
        var dto = OutgoingShipmentBuilder.BuildUpdateDto();
        dto.CustomStops =
        [
            new CustomStopDto { Kind = OutgoingShipmentStopKind.Company, Order = 1 },
            new CustomStopDto { Kind = OutgoingShipmentStopKind.Company, Order = 2 }
        ];

        var result = new UpdateOutgoingShipmentDtoValidator().TestValidate(dto);

        result.ShouldHaveValidationErrorFor(d => d.CustomStops);
    }

    /// <summary>
    /// The regression this task exists to prevent: with a Company stop on the run,
    /// re-sending the shipment unchanged must not read as changed content, or
    /// advancing the state becomes impossible.
    /// </summary>
    [Fact]
    public void ChangedFrozenFields_UnchangedRequestWithACompanyStop_ReturnsEmpty()
    {
        var (shipment, dto) = RoundTrippedWithCompanyStop();

        dto.State = OutgoingShipmentState.InTransit;

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto).Should().BeEmpty();
    }

    [Fact]
    public void ChangedFrozenFields_CompanyStopMoved_ReportsCustomStops()
    {
        var (shipment, dto) = RoundTrippedWithCompanyStop();

        dto.CustomStops[0].Order = 99;

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto)
            .Should().Contain(nameof(UpdateOutgoingShipmentDto.CustomStops));
    }
}
```

Two helpers are shared with Task 3: `Arrange(state, breweries)` and the `Company` options constant, both written into `ShipmentStartPointWriteTests` there. Lift them into an `internal static` helper class in the same namespace when this second consumer appears — do not copy them.

Build `RoundTrippedWithCompanyStop()` on the existing `RoundTripped()` helper in `ShipmentContentGuardTests.cs` — add one stored stop with `Kind = Company` and the matching `CustomStopDto`. If the helper is private there, lift it out the same way rather than duplicating it.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
dotnet test api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~CompanyStopTests"
```

Expected: compile error — `OutgoingShipmentStopKind.Company` and `CustomStopDto.Kind` do not exist.

- [ ] **Step 3: Add the enum member and the DTO field**

`Common/Enums/OutgoingShipmentStopKind.cs`:

```csharp
/// <summary>The company's own warehouse — where goods bought for stock come off.</summary>
Company = 2
```

`Features/OutgoingShipments/Utils/CustomStopDto.cs`:

```csharp
/// <summary>
/// Whether this is a free-form waypoint or the company warehouse.
/// </summary>
/// <remarks>
/// A <see cref="OutgoingShipmentStopKind.Company"/> stop's label and coordinates
/// are authored by the server from configuration — whatever the client sends in
/// those fields is ignored, so a stale client cannot pin the warehouse elsewhere.
/// Defaults to <see cref="OutgoingShipmentStopKind.Custom"/> so an existing
/// payload keeps its meaning.
/// </remarks>
public OutgoingShipmentStopKind Kind { get; set; } = OutgoingShipmentStopKind.Custom;
```

- [ ] **Step 4: Honour the kind when building stops**

In `UpdateOutgoingShipmentEndpoint.BuildCustomStops`, widen the existing-stop lookup and author the company fields. The method needs `CompanyOptions`, so inject `IOptions<CompanyOptions>` into the endpoint and drop `static`:

```csharp
private List<OutgoingShipmentStop> BuildCustomStops(List<CustomStopDto> customStops, OutgoingShipment outgoingShipment)
{
    var company = companyOptions.Value;

    // Both non-order kinds live in this list; filtering to Custom alone would make
    // every Company stop look new on each save and orphan the stored row.
    var existingById = outgoingShipment.Stops
        .Where(s => s.Kind is OutgoingShipmentStopKind.Custom or OutgoingShipmentStopKind.Company)
        .ToDictionary(s => s.PublicId);

    var result = new List<OutgoingShipmentStop>();
    foreach (var dto in customStops)
    {
        var isCompany = dto.Kind == OutgoingShipmentStopKind.Company;
        var label = isCompany ? company.Name : dto.Label;
        var latitude = isCompany ? company.Latitude : dto.Latitude;
        var longitude = isCompany ? company.Longitude : dto.Longitude;

        if (dto.Id is not null && existingById.TryGetValue(dto.Id.Value, out var existing))
        {
            existing.Kind = dto.Kind;
            existing.Order = dto.Order;
            existing.Label = label;
            existing.Note = dto.Note;
            existing.Latitude = latitude;
            existing.Longitude = longitude;
            result.Add(existing);
        }
        else
        {
            result.Add(new OutgoingShipmentStop
            {
                Kind = dto.Kind,
                Order = dto.Order,
                Label = label,
                Note = dto.Note,
                Latitude = latitude,
                Longitude = longitude
            });
        }
    }

    return result;
}
```

Apply the same authoring to the create endpoint's inline `req.Data.CustomStops.Select(...)` projection.

- [ ] **Step 5: Fix the content guard**

In `ShipmentContentGuard.CustomStopsMatch`, widen the filter and add `Kind` to both tuples:

```csharp
var storedStops = stored.Stops
    .Where(s => s.Kind is OutgoingShipmentStopKind.Custom or OutgoingShipmentStopKind.Company)
    .Select(s => (
        Id: (Guid?)s.PublicId,
        s.Kind,
        s.Order,
        s.Label,
        s.Note,
        s.Latitude,
        s.Longitude))
    .OrderBy(s => s.Id)
    .ToList();

var incomingStops = incoming.CustomStops
    .Select(s => (
        s.Id,
        s.Kind,
        s.Order,
        Label: (string?)s.Label,
        s.Note,
        Latitude: (decimal?)s.Latitude,
        Longitude: (decimal?)s.Longitude))
    .OrderBy(s => s.Id)
    .ToList();
```

The incoming Company stop's `Label`/`Latitude`/`Longitude` come from the client and are ignored on write, so a client that sends blanks for them would read here as a change. Normalize the incoming side through the same company values before comparing — build the projection from the authored values, not the raw DTO.

- [ ] **Step 6: Add the single-Company-stop rule**

In both DTO validators:

```csharp
RuleFor(dto => dto.CustomStops)
    .Must(stops => stops.Count(s => s.Kind == OutgoingShipmentStopKind.Company) <= 1)
    .WithErrorCode(ErrorCodes.ValidationNotEmptyError);
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
dotnet test api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~CompanyStopTests"
dotnet test api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj
```

Expected: all green. Watch `ShipmentContentGuardTests` and `UpdateOutgoingShipmentTests` specifically — they exercise the code paths this task changed.

- [ ] **Step 8: Commit**

```bash
git add api/AleTrack/AleTrack/Common/Enums/OutgoingShipmentStopKind.cs \
        api/AleTrack/AleTrack/Features/OutgoingShipments/ \
        api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/
git commit -m "feat: make the company warehouse a first-class stop kind"
```

---

## Task 5: Keep the Company stop in step with the stock purchases

**Files:**
- Create: `api/AleTrack/AleTrack/Features/OutgoingShipments/Utils/CompanyStopReconciler.cs`
- Modify: create and update endpoints (call it before `SaveChangesAsync`)
- Test: `api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/CompanyStopReconcilerTests.cs`

**Interfaces:**
- Consumes: `OutgoingShipmentStopKind.Company` (Task 4), `CompanyOptions` (Task 1).
- Produces: `CompanyStopReconciler.Apply(OutgoingShipment shipment, CompanyOptions company)` — mutates `shipment.Stops` in place, returns nothing.

- [ ] **Step 1: Write the failing test**

`CompanyStopReconcilerTests.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Common.Options;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using FluentAssertions;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// Goods bought for our own warehouse have to come off somewhere, so the warehouse
/// stop follows them: it appears with the first of them and goes with the last.
/// </summary>
public sealed class CompanyStopReconcilerTests
{
    private static readonly CompanyOptions Company = new()
    {
        Name = "AleTrack s.r.o.",
        StreetName = "Nádražní",
        StreetNumber = "12",
        City = "Liberec",
        Zip = "46001",
        Country = Country.Czechia,
        Latitude = 50.7663m,
        Longitude = 15.0543m
    };

    [Fact]
    public void Apply_StockPurchasesAndNoCompanyStop_AppendsOneLast()
    {
        var shipment = ShipmentWith(orderStops: 2, stockPurchases: 1);

        CompanyStopReconciler.Apply(shipment, Company);

        var companyStop = shipment.Stops.Single(s => s.Kind == OutgoingShipmentStopKind.Company);
        companyStop.Order.Should().Be(3);
        companyStop.Label.Should().Be("AleTrack s.r.o.");
        companyStop.Latitude.Should().Be(50.7663m);
    }

    /// <summary>
    /// The planner's ordering is the point: a run may call at the warehouse
    /// mid-route and carry on abroad afterwards. An unrelated save must not
    /// shove it back to the end.
    /// </summary>
    [Fact]
    public void Apply_CompanyStopAlreadyMidRoute_LeavesItsPositionAlone()
    {
        var shipment = ShipmentWith(orderStops: 4, stockPurchases: 1);
        shipment.Stops.Add(new OutgoingShipmentStop
        {
            Kind = OutgoingShipmentStopKind.Company,
            Order = 3,
            Label = "AleTrack s.r.o.",
            Latitude = 50.7663m,
            Longitude = 15.0543m
        });

        CompanyStopReconciler.Apply(shipment, Company);

        shipment.Stops.Count(s => s.Kind == OutgoingShipmentStopKind.Company).Should().Be(1);
        shipment.Stops.Single(s => s.Kind == OutgoingShipmentStopKind.Company).Order.Should().Be(3);
    }

    [Fact]
    public void Apply_LastStockPurchaseRemoved_DropsTheCompanyStop()
    {
        var shipment = ShipmentWith(orderStops: 2, stockPurchases: 0);
        shipment.Stops.Add(new OutgoingShipmentStop
        {
            Kind = OutgoingShipmentStopKind.Company,
            Order = 3,
            Label = "AleTrack s.r.o."
        });

        CompanyStopReconciler.Apply(shipment, Company);

        shipment.Stops.Should().NotContain(s => s.Kind == OutgoingShipmentStopKind.Company);
    }

    [Fact]
    public void Apply_NoStockPurchasesAndNoCompanyStop_ChangesNothing()
    {
        var shipment = ShipmentWith(orderStops: 2, stockPurchases: 0);

        CompanyStopReconciler.Apply(shipment, Company);

        shipment.Stops.Should().HaveCount(2);
    }

    /// <summary>
    /// A run with nothing but warehouse goods on it is legal — the stop is the
    /// only one, and numbering starts at 1 rather than at 0 or at 2.
    /// </summary>
    [Fact]
    public void Apply_StockPurchasesOnEmptyRoute_NumbersTheStopOne()
    {
        var shipment = ShipmentWith(orderStops: 0, stockPurchases: 1);

        CompanyStopReconciler.Apply(shipment, Company);

        shipment.Stops.Single().Order.Should().Be(1);
    }

    private static OutgoingShipment ShipmentWith(int orderStops, int stockPurchases)
    {
        var shipment = new OutgoingShipment
        {
            Name = "Vývoz",
            CreatedDate = DateTime.UtcNow,
            State = OutgoingShipmentState.Created
        };

        for (var i = 1; i <= orderStops; i++)
        {
            shipment.Stops.Add(new OutgoingShipmentStop
            {
                Kind = OutgoingShipmentStopKind.Order,
                Order = i
            });
        }

        for (var i = 0; i < stockPurchases; i++)
        {
            shipment.StockPurchases.Add(new OutgoingShipmentStockPurchaseItem
            {
                PublicId = Guid.NewGuid(),
                Quantity = 6
            });
        }

        return shipment;
    }
}
```

`OutgoingShipmentStockPurchaseItem` has a required `Product` navigation — read the entity and give the builder whatever it needs to construct.

- [ ] **Step 2: Run the test to verify it fails**

```bash
dotnet test api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~CompanyStopReconcilerTests"
```

Expected: compile error — `CompanyStopReconciler` does not exist.

- [ ] **Step 3: Write the reconciler**

`Features/OutgoingShipments/Utils/CompanyStopReconciler.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Common.Options;
using AleTrack.Entities;

namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// Keeps exactly one <see cref="OutgoingShipmentStopKind.Company"/> stop on a run
/// for as long as it carries goods bought for our own warehouse.
/// </summary>
/// <remarks>
/// Enforced server-side rather than in the two client write paths (the nakládka
/// toggles on the detail screen and the route save in the editor), because it is an
/// invariant of the shipment and one place cannot fall out of step with the other.
///
/// An existing stop keeps its position. A run may legitimately call at the warehouse
/// in the middle of the route — unload our goods, carry on abroad, come home — and
/// an unrelated save must not shove it back to the end.
/// </remarks>
public static class CompanyStopReconciler
{
    /// <summary>
    /// Adds, keeps or removes the company stop to match whether the run has any
    /// stock purchases.
    /// </summary>
    public static void Apply(OutgoingShipment shipment, CompanyOptions company)
    {
        var companyStop = shipment.Stops
            .FirstOrDefault(s => s.Kind == OutgoingShipmentStopKind.Company);

        if (shipment.StockPurchases.Count == 0)
        {
            if (companyStop is not null)
            {
                shipment.Stops.Remove(companyStop);
            }

            return;
        }

        if (companyStop is not null)
        {
            return;
        }

        var lastOrder = shipment.Stops.Count == 0 ? 0 : shipment.Stops.Max(s => s.Order);

        shipment.Stops.Add(new OutgoingShipmentStop
        {
            Kind = OutgoingShipmentStopKind.Company,
            Order = lastOrder + 1,
            Label = company.Name,
            Latitude = company.Latitude,
            Longitude = company.Longitude
        });
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
dotnet test api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~CompanyStopReconcilerTests"
```

Expected: 5 passed.

- [ ] **Step 5: Wire it into both endpoints**

In `UpdateOutgoingShipmentEndpoint.HandleAsync`, after `outgoingShipment.StockPurchases = stockPurchases;` and before the `Loaded`-without-stops check:

```csharp
// Only while the content is still open: past Created the stock purchases cannot
// change either, so there is nothing to reconcile and mutating a frozen run's
// stops would be a bug.
if (ShipmentMutability.IsContentEditable(outgoingShipment.State))
{
    CompanyStopReconciler.Apply(outgoingShipment, companyOptions.Value);
}
```

Read `outgoingShipment.State` here **before** the `outgoingShipment.State = req.Data.State;` assignment further down — the stored state is what decides whether content was open for this request.

In `CreateOutgoingShipmentEndpoint.HandleAsync`, call it after the entity is constructed and before `dbContext.OutgoingShipments.Add(...)`; a created shipment is always `Created`, so no gate is needed. Inject `IOptions<CompanyOptions>` into both endpoints.

- [ ] **Step 6: Run the full backend suite**

```bash
dotnet test api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add api/AleTrack/AleTrack/Features/OutgoingShipments/ \
        api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/CompanyStopReconcilerTests.cs
git commit -m "feat: keep the warehouse stop in step with the stock purchases"
```

---

## Task 6: Regenerate the client and add the start-points hook

**Files:**
- Modify: `app/src/generated/api-client.ts` (regenerated — never hand-edited)
- Modify: `app/src/api/queryKeys.ts`
- Modify: `app/src/hooks/useShipments.ts`

**Interfaces:**
- Consumes: `GET outgoing-shipments/start-points` (Task 1), the DTO fields from Tasks 2–4.
- Produces: `qk.shipmentStartPoints`; `useShipmentStartPoints(): UseQueryResult<ShipmentStartPointDto[]>`; generated types `ShipmentStartPointDto`, `ShipmentStartPointKind`, and `kind` on `CustomStopDto`.

- [ ] **Step 1: Start the backend and regenerate**

```bash
# terminal 1 — from api/AleTrack/
dotnet run --project AleTrack --launch-profile Local
# terminal 2 — from app/
yarn generate-api
```

Confirm the running instance is **this branch's** backend before regenerating: codegen silently picks up whatever holds port 8080, and a stale instance writes a stale client.

- [ ] **Step 2: Verify the regeneration brought the new shapes**

```bash
grep -n "class ShipmentStartPointDto\|enum ShipmentStartPointKind\|startPointKind" app/src/generated/api-client.ts | head
```

Expected: the DTO class, the enum, and `startPointKind` on the detail DTO. If any is missing, the backend was not the current build — restart it and regenerate rather than editing the file.

- [ ] **Step 3: Add the query key**

In `app/src/api/queryKeys.ts`, beside `shipmentOrders`:

```ts
shipmentStartPoints: ['shipments', 'start-points'] as const,
```

- [ ] **Step 4: Add the hook**

In `app/src/hooks/useShipments.ts`, matching the file's existing hook style:

```ts
/** Places a run may be loaded at: the company warehouse, then every brewery.
 *
 * Reference data that changes only when a brewery is added or its address is
 * corrected, so it is cached far longer than the 30s client default — every
 * shipment screen mounts it. */
export function useShipmentStartPoints() {
  const api = useDataSource();
  return useQuery({
    queryKey: qk.shipmentStartPoints,
    queryFn: () => api.getShipmentStartPoints(),
    staleTime: 30 * 60 * 1000,
  });
}
```

Take the generated method's real name from the client — NSwag derives it from `WithName(nameof(GetShipmentStartPointsEndpoint))`, and guessing it wrong is the usual first failure here.

- [ ] **Step 5: Typecheck**

```bash
yarn --cwd app build
```

Expected: passes. Nothing consumes the new fields yet, and every DTO change is additive, so the existing code still compiles.

- [ ] **Step 6: Commit**

```bash
git add app/src/generated/api-client.ts app/src/api/queryKeys.ts app/src/hooks/useShipments.ts
git commit -m "feat: regenerate the api client and expose shipment start points"
```

---

## Task 7: Delete DEPOT, give RouteMap explicit endpoints

**Files:**
- Modify: `app/src/lib/geo.ts`, `app/src/lib/geo.test.ts`
- Modify: `app/src/vite-env.d.ts`, `app/env.example`, `app/vitest.config.ts`
- Modify: `app/src/components/common/RouteMap.tsx`
- Modify: `app/src/features/shipments/ShipmentEditor.tsx`, `app/src/features/shipments/ShipmentDetail.tsx`

**Interfaces:**
- Consumes: `useShipmentStartPoints` (Task 6), `OutgoingShipmentDetailDto.startPoint*` (Task 2).
- Produces: `RouteMap` props `start: RouteEndpoint` and `end: RouteEndpoint`, where `interface RouteEndpoint { lat: number; lng: number; name: string; address?: string }`. Both **required** — no default — so `tsc` names every caller that has not been updated.

This task is atomic: `tsc` is red from the first deletion until the last caller is fixed. Do not commit halfway.

- [ ] **Step 1: Write the failing test**

Add to `app/src/features/shipments/ShipmentDetail.test.tsx`:

```tsx
it('draws the route from the shipment start point, not a fixed depot', () => {
  renderDetail({
    ...baseShipment,
    startPointKind: ShipmentStartPointKind.Brewery,
    startPointName: 'Pivovar Svijany',
    startPointLatitude: 50.5,
    startPointLongitude: 15.0,
  });

  expect(screen.getByText('Pivovar Svijany')).toBeInTheDocument();
});
```

Match the file's existing `renderDetail` helper and shipment fixture; if the RouteMap is mocked there, assert on the props handed to the mock instead of rendered text.

- [ ] **Step 2: Run the test to verify it fails**

```bash
yarn --cwd app test:run src/features/shipments/ShipmentDetail.test.tsx
```

Expected: FAIL — the start point is not rendered; the map still starts at `DEPOT`.

- [ ] **Step 3: Delete the depot**

From `app/src/lib/geo.ts`, delete the `DEPOT` export and `readDepot()`. Delete `VITE_COMPANY_ADDRESS` from `app/src/vite-env.d.ts`, its line from `app/env.example`, and its stub from `app/vitest.config.ts`'s `env` block. Delete the `readDepot`/`DEPOT` cases from `app/src/lib/geo.test.ts`, leaving the rest of that file alone.

- [ ] **Step 4: Give RouteMap its props**

In `app/src/components/common/RouteMap.tsx`:

```tsx
/** One end of a route — where the van is loaded, and where it comes home to. */
export interface RouteEndpoint {
  lat: number;
  lng: number;
  name: string;
  address?: string;
}
```

Add `start: RouteEndpoint` and `end: RouteEndpoint` to the component's props, then replace every `DEPOT` reference:

- the two waypoint entries around line 93–95 become `{ lat: start.lat, lng: start.lng }` (leading) and `{ lat: end.lat, lng: end.lng }` (trailing);
- the marker at line ~241 becomes two markers, one per endpoint. The popup text `"start i cíl trasy"` was only true when they were the same point — use `"start trasy"` and `"cíl trasy"`, and render a single marker with the old combined wording when `start.lat === end.lat && start.lng === end.lng`;
- the `depot={...}` prop at line ~286 takes `start`.

- [ ] **Step 5: Update both callers**

`ShipmentDetail.tsx` — build the endpoints from the shipment and the company entry:

```tsx
const startPoints = useShipmentStartPoints();
const company = (startPoints.data ?? []).find((p) => p.kind === ShipmentStartPointKind.Company);

// The detail DTO already carries the resolved start point, so the map does not
// wait on the start-points query for it — only the homeward end does.
const routeStart: RouteEndpoint = {
  lat: shipment.startPointLatitude ?? 0,
  lng: shipment.startPointLongitude ?? 0,
  name: shipment.startPointName ?? '—',
  address: shipment.startPointAddress,
};
const routeEnd: RouteEndpoint = company
  ? { lat: company.latitude ?? 0, lng: company.longitude ?? 0, name: company.name ?? '—', address: company.address }
  : routeStart;
```

`ShipmentEditor.tsx` — the start point is the picked one (Task 8 adds the picker; until then use the company entry), and the optimizer's origin at line ~467 changes from `let cur = { lat: DEPOT.lat, lng: DEPOT.lng };` to the same start endpoint. The two `?? DEPOT.lat` fallbacks at lines ~460–462 become `?? start.lat` / `?? start.lng`.

- [ ] **Step 6: Run the tests and typecheck**

```bash
yarn --cwd app test:run
yarn --cwd app build
```

Expected: the new test passes, the suite is green, and `tsc` is clean. A `tsc` error naming a file you have not touched means a third `RouteMap` caller exists — fix it rather than making the props optional.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/geo.ts app/src/lib/geo.test.ts app/src/vite-env.d.ts app/env.example \
        app/vitest.config.ts app/src/components/common/RouteMap.tsx \
        app/src/features/shipments/ShipmentEditor.tsx \
        app/src/features/shipments/ShipmentDetail.tsx \
        app/src/features/shipments/ShipmentDetail.test.tsx
git commit -m "refactor: route from the shipment's own endpoints, not a fixed depot"
```

---

## Task 8: The editor's start-point card

**Files:**
- Create: `app/src/features/shipments/StartPointPicker.tsx`
- Modify: `app/src/features/shipments/ShipmentEditor.tsx`
- Test: `app/src/features/shipments/ShipmentEditor.test.tsx`

**Interfaces:**
- Consumes: `useShipmentStartPoints` (Task 6), `RouteEndpoint` (Task 7).
- Produces: `<StartPointPicker value={{ kind, breweryId }} onChange={(next) => void} disabled?: boolean />`, rendering the card titled **Výchozí bod**.

- [ ] **Step 1: Write the failing test**

Add to `app/src/features/shipments/ShipmentEditor.test.tsx`:

```tsx
it('sends the picked start point in the save payload', async () => {
  renderEditor({ mode: 'edit' });

  fireEvent.mouseDown(screen.getByLabelText('Výchozí bod'));
  fireEvent.click(await screen.findByText('Pivovar Svijany'));
  fireEvent.click(screen.getByRole('button', { name: 'Uložit' }));

  await waitFor(() => {
    expect(updateShipmentMutateAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          startPointKind: ShipmentStartPointKind.Brewery,
          startBreweryId: /* the mocked Svijany brewery's id */,
        }),
      }),
    );
  });
});

it('locks the start point once the run is loaded', () => {
  renderEditor({ mode: 'edit', state: OutgoingShipmentState.Loaded });

  expect(screen.getByLabelText('Výchozí bod')).toHaveAttribute('aria-disabled', 'true');
});
```

> Corrected during execution. The original version of the first test asserted
> `screen.getByRole('button', { name: 'Uložit' })).toBeEnabled()` as a proxy for
> "the start point participates in dirty-tracking." That assertion is vacuous in
> this codebase: the Save button is `disabled={busy}` only and has never been
> gated by the `dirty` flag — `dirty` feeds solely `useUnsavedChangesGuard`, the
> nav-away blocker. The button is enabled from the first render, before the
> picker is even touched, so the test would pass even if `startPoint` were
> dropped from `serializeShipment` entirely. Testing the nav-guard directly needs
> a multi-route `MemoryRouter` harness with no precedent in this file — a
> disproportionate lift for what the test is actually meant to catch: a picked
> start point silently failing to reach the saved shipment. Asserting the save
> payload directly catches exactly that, and is simpler.

Mock `useShipmentStartPoints` alongside the file's other hook mocks, and make the mock able to express loading and error — not just a happy list. A mock that always succeeds cannot catch a crash on a missing one, which is how a page-level crash shipped here once.

- [ ] **Step 2: Run the test to verify it fails**

```bash
yarn --cwd app test:run src/features/shipments/ShipmentEditor.test.tsx
```

Expected: FAIL — no element labelled "Výchozí bod".

- [ ] **Step 3: Write the picker**

`app/src/features/shipments/StartPointPicker.tsx`:

```tsx
/** Where the run is loaded before it sets off.
 *
 * Sits above "Pořadí zastávek" because it is the route's first point without being
 * a stop: nothing is delivered there, so it is not in the numbering. The company is
 * first in the list and the default — that is what every run did before this
 * existed. */
export function StartPointPicker({ value, onChange, disabled }: {
  value: { kind: ShipmentStartPointKind; breweryId?: string };
  onChange: (next: { kind: ShipmentStartPointKind; breweryId?: string }) => void;
  disabled?: boolean;
}) {
  const { data, isPending, isError } = useShipmentStartPoints();

  return (
    <Card sx={{ overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" spacing={1}
        sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
        <WarehouseOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Výchozí bod</Typography>
      </Stack>
      <Box sx={{ px: 2.5, py: 2 }}>
        {isError ? (
          <Typography variant="caption" color="error">
            Výchozí body se nepodařilo načíst.
          </Typography>
        ) : (
          <Select
            size="small"
            fullWidth
            inputProps={{ 'aria-label': 'Výchozí bod' }}
            disabled={disabled || isPending}
            value={isPending ? '' : optionKey(value)}
            onChange={(e) => {
              const picked = (data ?? []).find((p) => optionKey(p) === e.target.value);
              if (picked) onChange({ kind: picked.kind!, breweryId: picked.breweryId });
            }}
          >
            {(data ?? []).map((point) => (
              <MenuItem key={optionKey(point)} value={optionKey(point)}>
                {point.name}
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  {point.address}
                </Typography>
              </MenuItem>
            ))}
          </Select>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Místo, kde se vůz naloží. Není zastávkou trasy.
        </Typography>
      </Box>
    </Card>
  );
}

/** Stable <Select> value for a start point — the company has no id of its own. */
function optionKey(point: { kind?: ShipmentStartPointKind; breweryId?: string }): string {
  return point.kind === ShipmentStartPointKind.Company ? 'company' : `brewery:${point.breweryId ?? ''}`;
}
```

`isPending` renders a disabled empty select rather than a `<Select>` over `undefined`; `isError` swaps in a message. Match the surrounding cards' chrome exactly — the header row above is copied from the "Celková nakládka" card so the two sit together without a seam.

- [ ] **Step 4: Wire it into the editor**

In `ShipmentEditor.tsx`:

- `const [startPoint, setStartPoint] = useState<{ kind: ShipmentStartPointKind; breweryId?: string }>({ kind: ShipmentStartPointKind.Company });`
- load it in the `mode === 'edit'` effect from `s.startPointKind` / `s.startBreweryId`, and include it in that effect's `baselineRef.current` snapshot;
- add it to `serializeShipment`'s payload so a change marks the form dirty:
  ```ts
  startPoint: { kind: startPoint.kind, breweryId: startPoint.breweryId ?? null },
  ```
  — this changes the function's signature, so update both call sites;
- render `<StartPointPicker ... disabled={structureLocked} />` immediately above the "Pořadí zastávek" card;
- feed `RouteMap`'s `start` from the picked point's coordinates (look it up in the start-points list by `optionKey`);
- send `startPointKind` / `startBreweryId` in both the create and update payloads in `persist()`.

- [ ] **Step 5: Run the tests and typecheck**

```bash
yarn --cwd app test:run src/features/shipments/ShipmentEditor.test.tsx
yarn --cwd app build
```

Expected: both new tests pass, `tsc` clean.

- [ ] **Step 6: Commit**

```bash
git add app/src/features/shipments/StartPointPicker.tsx \
        app/src/features/shipments/ShipmentEditor.tsx \
        app/src/features/shipments/ShipmentEditor.test.tsx
git commit -m "feat: pick where a run starts in the shipment editor"
```

---

## Task 9: The company option in the custom-stop dialog

**Files:**
- Modify: `app/src/components/common/CustomStopDialog.tsx`
- Modify: `app/src/features/shipments/ShipmentEditor.tsx` (its `addCustomStop` caller)
- Test: `app/src/components/common/CustomStopDialog.test.tsx` (create)

**Interfaces:**
- Consumes: `useShipmentStartPoints` (Task 6).
- Produces: `onAdd` payload widens to
  `{ kind: 'custom'; label: string; note?: string; lat: number; lng: number } | { kind: 'company' }`.
  A new prop `hasCompanyStop: boolean` disables the company mode.

- [ ] **Step 1: Write the failing test**

`app/src/components/common/CustomStopDialog.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { CustomStopDialog } from './CustomStopDialog';

describe('CustomStopDialog', () => {
  it('returns a company stop without asking for an address', () => {
    const onAdd = vi.fn();
    render(<CustomStopDialog open onClose={() => {}} onAdd={onAdd} hasCompanyStop={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Firemní sklad' }));
    fireEvent.click(screen.getByRole('button', { name: 'Přidat zastávku' }));

    expect(onAdd).toHaveBeenCalledWith({ kind: 'company' });
  });

  it('hides the map picker in company mode', () => {
    render(<CustomStopDialog open onClose={() => {}} onAdd={() => {}} hasCompanyStop={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Firemní sklad' }));

    expect(screen.queryByLabelText('Název zastávky')).not.toBeInTheDocument();
  });

  it('disables the company option when the route already has one', () => {
    render(<CustomStopDialog open onClose={() => {}} onAdd={() => {}} hasCompanyStop />);

    expect(screen.getByRole('button', { name: 'Firemní sklad' })).toBeDisabled();
  });
});
```

Mock `useShipmentStartPoints` at the top of the file — the dialog reads the company address from it.

- [ ] **Step 2: Run the test to verify it fails**

```bash
yarn --cwd app test:run src/components/common/CustomStopDialog.test.tsx
```

Expected: FAIL — no "Firemní sklad" button.

- [ ] **Step 3: Add the mode toggle**

In `CustomStopDialog.tsx`, add `const [mode, setMode] = useState<'custom' | 'company'>('custom');` and a two-button `ToggleButtonGroup` at the top of the content — *Vlastní místo* / *Firemní sklad*, the latter `disabled={hasCompanyStop}` with a tooltip reading `Trasa už zastávku ve firmě má.`

Company mode replaces the picker and the two text fields with a read-only address block from the start-points query's company entry. `confirm()` branches:

```tsx
const confirm = () => {
  if (mode === 'company') {
    onAdd({ kind: 'company' });
    reset();
    onClose();
    return;
  }
  if (!point) {
    enqueueSnackbar('Určete místo zastávky vyhledáním adresy nebo kliknutím do mapy.', { variant: 'warning' });
    return;
  }
  if (!label.trim()) {
    enqueueSnackbar('Zadejte název zastávky.', { variant: 'warning' });
    return;
  }
  onAdd({ kind: 'custom', label: label.trim(), note: note.trim() || undefined, lat: point.lat, lng: point.lng });
  reset();
  onClose();
};
```

`reset()` must also restore `mode` to `'custom'`, or reopening the dialog lands in the wrong mode.

- [ ] **Step 4: Update the caller**

In `ShipmentEditor.tsx`, `addCustomStop` branches on the payload's `kind`. A company stop takes its coordinates from the start-points company entry and its label from the same, appended last like any other new stop, with `kind: 'company'` on the `DraftStop`. Pass `hasCompanyStop={stops.some((s) => s.kind === 'company')}`.

`DraftStop['kind']` widens from `'order' | 'custom'` to `'order' | 'custom' | 'company'`; `tsc` will name every switch that needs a third arm, including `serializeShipment`, `routeStops` and the save payload, where a company stop is sent as a `CustomStopDto` with `kind: OutgoingShipmentStopKind.Company`.

`SortableStopRow` needs a third presentation: a company stop shows a warehouse icon (`WarehouseOutlined`) instead of the custom stop's place pin, its label as the title, and the company address as the second line, in place of `resolveStopAddress`. It stays draggable — the position is the planner's.

Its delete button stays enabled but carries a tooltip:

```tsx
title={hasStockPurchases
  ? 'Dokud je v nakládce zboží na sklad, zastávka se po uložení vrátí.'
  : ''}
```

The server re-adds it while goods are on the nakládka (Task 5), and a button that silently undoes its own click is worse than one that says so. `hasStockPurchases` comes from `shipmentQuery.data?.stockPurchases?.length`.

- [ ] **Step 5: Run the tests and typecheck**

```bash
yarn --cwd app test:run src/components/common/CustomStopDialog.test.tsx
yarn --cwd app build
```

Expected: 3 passed, `tsc` clean.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/common/CustomStopDialog.tsx \
        app/src/components/common/CustomStopDialog.test.tsx \
        app/src/features/shipments/ShipmentEditor.tsx
git commit -m "feat: add the company warehouse from the custom-stop dialog"
```

---

## Task 10: The unload-order shaping module

**Files:**
- Create: `app/src/features/shipments/unloadOrder.ts`
- Create: `app/src/features/shipments/unloadOrder.test.ts`

**Interfaces:**
- Consumes: generated `OutgoingShipmentStopDto`, `OutgoingShipmentStockPurchaseItemDto`, `OutgoingShipmentStopKind`; existing `resolveDetailStopAddress` from `./stopAddress`.
- Produces: `UnloadLine`, `UnloadStop`, `unloadOrder(stops, stockPurchases): UnloadStop[]`.

- [ ] **Step 1: Write the failing test**

`app/src/features/shipments/unloadOrder.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { OutgoingShipmentStopDto, OutgoingShipmentStopKind } from 'src/generated/api-client';
import { unloadOrder } from './unloadOrder';

const orderStop = (order: number, clientName: string, products: unknown[] = []) =>
  new OutgoingShipmentStopDto({
    id: `stop-${order}`, order, kind: OutgoingShipmentStopKind.Order, clientName, products,
  } as never);

describe('unloadOrder', () => {
  it('lists stops in route order regardless of the order they arrive in', () => {
    const result = unloadOrder([orderStop(2, 'Bílý Kostel'), orderStop(1, 'Chrastava')], []);

    expect(result.map((s) => s.seq)).toEqual([1, 2]);
    expect(result.map((s) => s.title)).toEqual(['Chrastava', 'Bílý Kostel']);
  });

  it('puts the stock purchases on the company stop', () => {
    const company = new OutgoingShipmentStopDto({
      id: 'hq', order: 2, kind: OutgoingShipmentStopKind.Company, label: 'AleTrack s.r.o.',
    } as never);
    const purchases = [{ name: 'Svijanský Rytíř', quantity: 48, packageSize: 0.5 }];

    const result = unloadOrder([orderStop(1, 'Chrastava'), company], purchases as never);

    expect(result[1].kind).toBe('company');
    expect(result[1].lines).toEqual([
      expect.objectContaining({ name: 'Svijanský Rytíř', quantity: 48 }),
    ]);
  });

  it('keeps a custom stop that unloads nothing', () => {
    const fuel = new OutgoingShipmentStopDto({
      id: 'fuel', order: 1, kind: OutgoingShipmentStopKind.Custom,
      label: 'Čerpací stanice', note: 'natankovat',
    } as never);

    const result = unloadOrder([fuel], []);

    expect(result).toHaveLength(1);
    expect(result[0].lines).toEqual([]);
    expect(result[0].note).toBe('natankovat');
  });

  it('returns nothing for a shipment with no stops', () => {
    expect(unloadOrder([], [])).toEqual([]);
  });

  it('numbers sequentially even when the stored orders have gaps', () => {
    const result = unloadOrder([orderStop(3, 'A'), orderStop(9, 'B')], []);

    expect(result.map((s) => s.seq)).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
yarn --cwd app test:run src/features/shipments/unloadOrder.test.ts
```

Expected: FAIL — cannot resolve `./unloadOrder`.

- [ ] **Step 3: Write the module**

```ts
// What comes off the van, stop by stop, in the order the driver reaches them.
//
// The nakládka is the mirror image of this: it aggregates per product and sections
// by brewery, which is exactly right at the ramp where the pallet is packed brewery
// by brewery. On the road the question is the other one — "what comes off here" —
// so this shape is per stop and keeps each order's lines separate.
//
// Kept out of ShipmentDetail (already ~1720 lines) so the ordering can be checked
// without a rendering harness, same as nakladkaGrouping.ts.

/** One product to take off the van at a stop. */
export interface UnloadLine {
  name: string;
  /** Degree and package size, as on the loading list. */
  chip: string;
  quantity: number;
}

/** One stop on the driver's run. */
export interface UnloadStop {
  /** 1-based position on the route. Renumbered here: stored orders may have gaps. */
  seq: number;
  kind: 'order' | 'custom' | 'company';
  /** Client name, custom label, or the company name. */
  title: string;
  /** Resolved address line, when the stop has one. */
  subtitle?: string;
  note?: string;
  lines: UnloadLine[];
}

export function unloadOrder(
  stops: OutgoingShipmentStopDto[],
  stockPurchases: OutgoingShipmentStockPurchaseItemDto[],
): UnloadStop[] {
  return stops
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((stop, index) => ({ ...shapeStop(stop, stockPurchases), seq: index + 1 }));
}
```

`shapeStop` switches on `stopKindName(stop.kind)` — the API serializes enums as **strings** while the generated TS enum is numeric, so a bare `stop.kind === OutgoingShipmentStopKind.Company` is always false for real data. Add a `stopKindName` helper to `src/lib/labels.ts` next to the existing `shipStateName` / `addrKindValue` normalizers and use it here; the tests above construct DTOs with numeric enums, so also make the helper accept both, exactly as `addrKindValue` does.

Order stops take `title` from `clientName`, `subtitle` from `resolveDetailStopAddress(stop).text`, and lines from `stop.products`. Company stops take `title` from `label`, lines from `stockPurchases`. Custom stops take `title` from `label`, `note` from `note`, and no lines. Build `chip` with the existing `platoSizeChipText` logic — lift it out of `ShipmentDetail.tsx` into this module and import it back there, rather than duplicating the format.

- [ ] **Step 4: Run the test to verify it passes**

```bash
yarn --cwd app test:run src/features/shipments/unloadOrder.test.ts
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add app/src/features/shipments/unloadOrder.ts \
        app/src/features/shipments/unloadOrder.test.ts \
        app/src/lib/labels.ts \
        app/src/features/shipments/ShipmentDetail.tsx
git commit -m "feat: shape a shipment's stops into the driver's unload order"
```

---

## Task 11: The Vykládka tab

**Files:**
- Create: `app/src/features/shipments/UnloadOrderList.tsx`
- Modify: `app/src/features/shipments/ShipmentDetail.tsx`
- Test: `app/src/features/shipments/ShipmentDetail.test.tsx`

**Interfaces:**
- Consumes: `unloadOrder`, `UnloadStop` (Task 10); the shipment's resolved start point (Task 2).
- Produces: `<UnloadOrderList stops={UnloadStop[]} startPoint={{ name: string; address?: string }} />`; the `SegControl` value `'unload'`.

- [ ] **Step 1: Write the failing test**

Add to `app/src/features/shipments/ShipmentDetail.test.tsx`:

```tsx
describe('ShipmentDetail — the Vykládka tab', () => {
  it('swaps the loading table for the stop-by-stop list', () => {
    renderDetail(shipmentWithTwoStops);

    fireEvent.click(screen.getByRole('button', { name: 'Vykládka' }));

    expect(screen.getByText('Chrastava')).toBeInTheDocument();
    expect(screen.queryByTestId('nakladka-row')).not.toBeInTheDocument();
  });

  it('names the start point above the numbered stops', () => {
    renderDetail({ ...shipmentWithTwoStops, startPointName: 'Pivovar Svijany' });

    fireEvent.click(screen.getByRole('button', { name: 'Vykládka' }));

    expect(screen.getByText(/Pivovar Svijany/)).toBeInTheDocument();
  });

  it('keeps the invoice tabs reachable from the unload view', () => {
    renderDetail(shipmentWithTwoStops);

    fireEvent.click(screen.getByRole('button', { name: 'Vykládka' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vše' }));

    expect(screen.getAllByTestId('nakladka-row').length).toBeGreaterThan(0);
  });
});
```

`nakladka-row` is the existing `data-testid` at `ShipmentDetail.tsx:422`. Reuse the file's fixtures rather than new ones.

- [ ] **Step 2: Run the test to verify it fails**

```bash
yarn --cwd app test:run src/features/shipments/ShipmentDetail.test.tsx
```

Expected: FAIL — no "Vykládka" control.

- [ ] **Step 3: Write the list**

`app/src/features/shipments/UnloadOrderList.tsx` — the start point as a header line, then a numbered block per stop: a circled `seq`, the title, the address as a second line, the note if any, then the lines as `name · chip · × quantity` with `fontVariantNumeric: 'tabular-nums'` on the quantity so the column reads straight. A stop with no lines shows a muted `Bez vykládky`. Colours from theme tokens via `theme.vars.palette.*`; no hex literals.

- [ ] **Step 4: Add the tab**

In `ShipmentDetail.tsx`:

```tsx
/** Tab value for the driver's stop-by-stop view; the rest filter the loading list. */
const UNLOAD_VIEW = 'unload';
```

Append to `filterOptions`, after the invoice columns:

```tsx
{ value: UNLOAD_VIEW, label: 'Vykládka' },
```

`activeFilter` already falls back to `ALL_INVOICES` for a value not in the options, so a deleted invoice cannot strand the view. Then branch the card body:

```tsx
{activeFilter === UNLOAD_VIEW ? (
  <UnloadOrderList
    stops={unloadStops}
    startPoint={{ name: shipment.startPointName ?? '—', address: shipment.startPointAddress }}
  />
) : (
  <AggLoadingTable ... />
)}
```

with `const unloadStops = useMemo(() => unloadOrder(stopsSorted, shipment.stockPurchases ?? []), [stopsSorted, shipment.stockPurchases]);`.

The progress pills and the header buttons stay — they describe the run, not the table.

- [ ] **Step 5: Run the tests and the full verification**

```bash
yarn --cwd app test:run
yarn --cwd app build
yarn --cwd app lint
```

Expected: whole suite green, `tsc` clean, lint 0 errors. Four `react-refresh/only-export-components` warnings in `AuthProvider`, `UnsavedChangesGuard`, `CurrencyProvider` and `ThemeProvider` are pre-existing and not yours to fix.

- [ ] **Step 6: Run the backend suite one final time**

```bash
dotnet test api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj
```

Expected: green. Both stacks must pass — the work item touches `api/**` and `app/**`.

- [ ] **Step 7: Commit**

```bash
git add app/src/features/shipments/UnloadOrderList.tsx \
        app/src/features/shipments/ShipmentDetail.tsx \
        app/src/features/shipments/ShipmentDetail.test.tsx
git commit -m "feat: show the driver what comes off at each stop"
```

---

## Manual check before opening the PR

Automated tests do not cover the map or the migration. With the backend on `Local` and `yarn dev:local` running:

1. Apply the migration against your local DB:
   `dotnet ef database update --connection "Host=localhost;Port=5432;Database=AleTrack;Username=postgres;Password=postgres"`
2. Open a planned run's editor. Set the start point to a brewery — the map's start marker moves there and the route redraws from it.
3. Add "Zboží na sklad" on the detail screen. Reload: a company stop is now last on the route.
4. Drag it to the middle, save, then tick a nakládka checkbox. It stays in the middle.
5. Remove the last stock-purchase row. The company stop disappears.
6. Open the Vykládka tab and check the stops read in route order with the right goods under each.
7. Advance the run to Naloženo. The state change must succeed — if it is rejected as frozen content, the `ShipmentContentGuard` normalization in Task 4 Step 5 is wrong.
