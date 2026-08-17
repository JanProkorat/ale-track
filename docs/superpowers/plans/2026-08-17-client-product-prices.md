# Client-specific product prices — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A client can carry its own price per product, applying to every order and counter sale, while the price actually charged freezes on the line it was billed on.

**Architecture:** A `ClientProductPrice` row per `(client, product)` holding only the price with VAT. Reads resolve through a dictionary lookup (`ClientPriceResolver`) rather than a SQL join, so the DbContext-free `ShipmentContentSnapshotWriter` can be handed a lookup and stay that way. Writes go through a `Features/ClientProductPrices/` slice; a batch replace endpoint backs the bulk catalog editor. The frontend resolves counter-sale defaults client-side from the same list query the Ceník tab uses, so no inventory endpoint changes.

**Tech Stack:** .NET 10, FastEndpoints, EF Core + Npgsql, xUnit + FluentAssertions + Moq.EntityFrameworkCore; React 19, Vite 6, MUI 7, TanStack Query 5, NSwag codegen.

**Spec:** `docs/superpowers/specs/2026-07-29-client-product-prices-design.md`

**Prototype (approved design):** `docs/prototype/aletrack-prototype.html` — `clCenikView`, `clPriceForm`, `clBulkPriceForm`, `priceFor`, `priceCell`. Port these, do not reinterpret them (`app/CLAUDE.md`, Prototype fidelity).

## Global Constraints

- **Naming:** the catalog price carried beside a charged one is `ListPriceWithVat` / `listPriceWithVat` everywhere — never `CatalogPriceWithVat`. Precedent is `SaleItem.ListPriceWithVat`.
- **Endpoints:** `internal sealed`, `DontCatchExceptions()`, `.RequirePermission(ModuleType.Clients, PermissionLevel.View|Edit)` inside `Description(b => …)`, `ThrowHelper.PublicEntityNotFound` for 404. `InternalsVisibleTo AleTrack.Tests` is already set (`AleTrack.csproj:48`), so internal endpoints are testable.
- **EF:** `Guid` public ids via `PublicEntity`; `AsNoTracking()` on every read; `DateOnly` for calendar dates; enums as strings.
- **Percentage is never stored.** It is an input the bulk editor uses to fill absolute prices. Nothing reads a percentage back.
- **UI copy is Czech; identifiers and comments are English.** Money renders through `useCurrency().formatMoney`, never a local formatter.
- **No `any`**, no hand-edits to `app/src/generated/api-client.ts`.
- **Backend DTO change + its frontend consumption land in the same commit** (root `CLAUDE.md`). Task 12 is the codegen seam; frontend tasks come after it.
- **Verification:** run the `dotnet-verify` skill for `api/**` changes and `react-verify` for `app/**`. Never call `dotnet test` / `yarn build` directly.

---

### Task 1: The entity, its table, and the pure resolver

**Files:**
- Create: `api/AleTrack/AleTrack/Entities/ClientProductPrice.cs`
- Create: `api/AleTrack/AleTrack/Infrastructure/Persistence/Configurations/ClientProductPriceConfiguration.cs`
- Create: `api/AleTrack/AleTrack/Common/Utils/ClientPriceResolver.cs`
- Modify: `api/AleTrack/AleTrack/Infrastructure/Persistence/AleTrackDbContext.cs` (add the `DbSet`)
- Modify: `api/AleTrack/AleTrack/Entities/Client.cs` (add the navigation)
- Modify: `api/AleTrack/AleTrack.Tests/Mocks/AleTrackDbContextMockFactory.cs` (add an optional `clientProductPrices` parameter)
- Test: `api/AleTrack/AleTrack.Tests/Common/ClientPriceResolverTests.cs`

**Interfaces:**
- Consumes: nothing.
- Produces: `ClientProductPrice` (`ClientId: long`, `ProductId: long`, `PriceWithVat: decimal`, `SetOn: DateOnly`, `Client`, `Product`); `ClientPriceList` with `Resolve(Product product) → ResolvedPrice`; `readonly record struct ResolvedPrice(decimal PriceWithVat, decimal? PriceWithoutVat, decimal? PriceForUnitWithVat, decimal? PriceForUnitWithoutVat, decimal? ListPriceWithVat)`; `ClientPriceList.Empty`.

- [ ] **Step 1: Write the failing resolver tests**

```csharp
using AleTrack.Common.Utils;
using AleTrack.Entities;
using FluentAssertions;

namespace AleTrack.Tests.Common;

public sealed class ClientPriceResolverTests
{
    private static Product Product(decimal withVat = 1290m, decimal? withoutVat = 1066m,
        decimal? unitWithVat = 43m, decimal? unitWithoutVat = 35.53m) => new()
    {
        Id = 1,
        Name = "Albrecht 12°",
        PriceWithVat = withVat,
        PriceWithoutVat = withoutVat,
        PriceForUnitWithVat = unitWithVat,
        PriceForUnitWithoutVat = unitWithoutVat
    };

    [Fact]
    public void Resolve_NoOverride_ReturnsCatalogPricesAndNullListPrice()
    {
        var resolved = ClientPriceList.Empty.Resolve(Product());

        resolved.PriceWithVat.Should().Be(1290m);
        resolved.PriceWithoutVat.Should().Be(1066m);
        resolved.ListPriceWithVat.Should().BeNull();
    }

    [Fact]
    public void Resolve_Override_ScalesDerivedFieldsByTheProductsOwnRatio()
    {
        var list = new ClientPriceList(new Dictionary<long, decimal> { [1] = 1190m });

        var resolved = list.Resolve(Product());

        resolved.PriceWithVat.Should().Be(1190m);
        // 1190/1290 = 0.92248…; 1066 * that = 983.36
        resolved.PriceWithoutVat.Should().Be(983.36m);
        resolved.PriceForUnitWithVat.Should().Be(39.67m);
        resolved.ListPriceWithVat.Should().Be(1290m);
    }

    [Fact]
    public void Resolve_Override_NullDerivedFieldsStayNull()
    {
        var list = new ClientPriceList(new Dictionary<long, decimal> { [1] = 1190m });

        var resolved = list.Resolve(Product(withoutVat: null, unitWithVat: null, unitWithoutVat: null));

        resolved.PriceWithVat.Should().Be(1190m);
        resolved.PriceWithoutVat.Should().BeNull();
        resolved.PriceForUnitWithVat.Should().BeNull();
        resolved.ListPriceWithVat.Should().Be(1290m);
    }

    [Fact]
    public void Resolve_ZeroPricedProduct_TakesOverrideAndKeepsProductsOwnDerivedFields()
    {
        // The ratio is undefined, so the three derived fields keep the product's values
        // rather than collapsing to zero. Matches BulkPriceDrawer's ratio = 1 fallback.
        var list = new ClientPriceList(new Dictionary<long, decimal> { [1] = 500m });

        var resolved = list.Resolve(Product(withVat: 0m, withoutVat: 10m, unitWithVat: 2m, unitWithoutVat: 1m));

        resolved.PriceWithVat.Should().Be(500m);
        resolved.PriceWithoutVat.Should().Be(10m);
        resolved.PriceForUnitWithVat.Should().Be(2m);
        resolved.ListPriceWithVat.Should().Be(0m);
    }

    [Fact]
    public void Resolve_OverrideEqualToCatalog_StillReportsListPrice()
    {
        // A price deliberately set to the ceník value is still an override: the row
        // exists, so the UI must be able to say so.
        var list = new ClientPriceList(new Dictionary<long, decimal> { [1] = 1290m });

        var resolved = list.Resolve(Product());

        resolved.PriceWithVat.Should().Be(1290m);
        resolved.ListPriceWithVat.Should().Be(1290m);
    }
}
```

- [ ] **Step 2: Run the tests and watch them fail**

Run the `dotnet-verify` skill scoped to `ClientPriceResolverTests`.
Expected: compile failure — `ClientPriceList` does not exist.

- [ ] **Step 3: Write the entity**

```csharp
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// A price this client pays for one product, in place of the brewery's ceník price.
/// </summary>
/// <remarks>
/// Deliberately not softly deletable: removing the row reverts the client to the ceník
/// price and cannot rewrite history, because every invoice line froze its own
/// <see cref="OutgoingShipmentInvoiceLine.UnitPriceWithVat"/> at billing time.
/// </remarks>
[Table("client_product_prices")]
public sealed class ClientProductPrice : PublicEntity
{
    /// <summary>
    /// ID of the owning <see cref="Entities.Client"/>
    /// </summary>
    [Column("client_id")]
    public long ClientId { get; set; }

    /// <summary>
    /// ID of the priced <see cref="Entities.Product"/>
    /// </summary>
    [Column("product_id")]
    public long ProductId { get; set; }

    /// <summary>
    /// The only operator-entered value; the other three price fields are derived from
    /// the product's own ratios at read time.
    /// </summary>
    [Column("price_with_vat")]
    public required decimal PriceWithVat { get; set; }

    /// <summary>
    /// When this price was last decided. Provenance only — nothing reads it to decide
    /// whether the price applies, and it is not a validity date.
    /// </summary>
    [Column("set_on")]
    public required DateOnly SetOn { get; set; }

    /// <summary>
    /// The owning client. Cascade: deleting a client drops its price list.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public Client Client { get; set; } = null!;

    /// <summary>
    /// The priced product. Restrict, not the EF default — a product must not be
    /// deletable out from under rows referencing it without the caller noticing.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Restrict)]
    public Product Product { get; set; } = null!;
}
```

- [ ] **Step 4: Write the EF configuration**

```csharp
using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

public sealed class ClientProductPriceConfiguration : IEntityTypeConfiguration<ClientProductPrice>
{
    public void Configure(EntityTypeBuilder<ClientProductPrice> builder)
    {
        // One price per client per product — the pair is the real key, and the upsert
        // endpoint relies on this to stay true.
        builder.HasIndex(x => new { x.ClientId, x.ProductId }).IsUnique();

        // FK columns are indexed for the per-client list read and for the product-side
        // Restrict check.
        builder.HasIndex(x => x.ProductId);
    }
}
```

- [ ] **Step 5: Register the DbSet and the navigation**

In `AleTrackDbContext`, beside the other `DbSet` properties:

```csharp
/// <summary>
/// Client-specific product prices
/// </summary>
public DbSet<ClientProductPrice> ClientProductPrices => Set<ClientProductPrice>();
```

In `Client.cs`, beside `DeliveryPlaces`:

```csharp
/// <summary>
/// Custom product prices that apply to every order and counter sale from this client
/// </summary>
public List<ClientProductPrice> ProductPrices { get; set; } = [];
```

- [ ] **Step 6: Extend the DbContext mock factory**

Add the parameter at the END of `CreateMock`'s parameter list (appending keeps every existing call site compiling — see the harness trap in the spec's Testing section) and pass it through to `SetupDbContextMock` in the same position that method expects:

```csharp
ICollection<ClientProductPrice>? clientProductPrices = null)
```

- [ ] **Step 7: Write the resolver**

```csharp
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Common.Utils;

/// <summary>
/// The four effective price fields for one product and one client.
/// </summary>
/// <remarks>
/// <see cref="ListPriceWithVat"/> is non-null only when a client price is being applied,
/// so a non-null value is itself the signal that the row is a special price.
/// </remarks>
public readonly record struct ResolvedPrice(
    decimal PriceWithVat,
    decimal? PriceWithoutVat,
    decimal? PriceForUnitWithVat,
    decimal? PriceForUnitWithoutVat,
    decimal? ListPriceWithVat);

/// <summary>
/// A client's price overrides, keyed by product id.
/// </summary>
public sealed class ClientPriceList(IReadOnlyDictionary<long, decimal> pricesByProductId)
{
    /// <summary>
    /// A client with no overrides, and the value to use when no client is in scope.
    /// </summary>
    public static ClientPriceList Empty { get; } = new(new Dictionary<long, decimal>());

    /// <summary>
    /// Resolves the effective prices for a product.
    /// </summary>
    public ResolvedPrice Resolve(Product product)
    {
        if (!pricesByProductId.TryGetValue(product.Id, out var overridePrice))
        {
            return new ResolvedPrice(
                product.PriceWithVat,
                product.PriceWithoutVat,
                product.PriceForUnitWithVat,
                product.PriceForUnitWithoutVat,
                null);
        }

        // A product priced at zero has no ratio to scale by; the override takes the
        // headline price and the derived fields keep the product's own values.
        if (product.PriceWithVat == 0m)
        {
            return new ResolvedPrice(
                overridePrice,
                product.PriceWithoutVat,
                product.PriceForUnitWithVat,
                product.PriceForUnitWithoutVat,
                product.PriceWithVat);
        }

        var ratio = overridePrice / product.PriceWithVat;

        return new ResolvedPrice(
            overridePrice,
            Scale(product.PriceWithoutVat, ratio),
            Scale(product.PriceForUnitWithVat, ratio),
            Scale(product.PriceForUnitWithoutVat, ratio),
            product.PriceWithVat);
    }

    private static decimal? Scale(decimal? value, decimal ratio) =>
        value is null ? null : Math.Round(value.Value * ratio, 2, MidpointRounding.AwayFromZero);
}

/// <summary>
/// Loads a client's price overrides.
/// </summary>
public static class ClientPriceResolver
{
    /// <summary>
    /// Loads the price list for a client by database id.
    /// </summary>
    public static async Task<ClientPriceList> LoadAsync(
        AleTrackDbContext dbContext,
        long clientId,
        CancellationToken ct)
    {
        var prices = await dbContext.ClientProductPrices
            .AsNoTracking()
            .Where(p => p.ClientId == clientId)
            .Select(p => new { p.ProductId, p.PriceWithVat })
            .ToListAsync(ct);

        return new ClientPriceList(prices.ToDictionary(p => p.ProductId, p => p.PriceWithVat));
    }

    /// <summary>
    /// Loads the price list for a client by public id. Returns an empty list when the
    /// client id is null — a walk-in counter sale, or a query with no client in scope.
    /// </summary>
    public static async Task<ClientPriceList> LoadByPublicIdAsync(
        AleTrackDbContext dbContext,
        Guid? clientPublicId,
        CancellationToken ct)
    {
        if (clientPublicId is null)
        {
            return ClientPriceList.Empty;
        }

        var prices = await dbContext.ClientProductPrices
            .AsNoTracking()
            .Where(p => p.Client.PublicId == clientPublicId.Value)
            .Select(p => new { p.ProductId, p.PriceWithVat })
            .ToListAsync(ct);

        return new ClientPriceList(prices.ToDictionary(p => p.ProductId, p => p.PriceWithVat));
    }
}
```

- [ ] **Step 8: Run the tests and watch them pass**

Run the `dotnet-verify` skill scoped to `ClientPriceResolverTests`. Expected: 5 passed.

- [ ] **Step 9: Commit**

```bash
git add api/AleTrack/AleTrack/Entities/ClientProductPrice.cs \
  api/AleTrack/AleTrack/Entities/Client.cs \
  api/AleTrack/AleTrack/Infrastructure/Persistence/Configurations/ClientProductPriceConfiguration.cs \
  api/AleTrack/AleTrack/Infrastructure/Persistence/AleTrackDbContext.cs \
  api/AleTrack/AleTrack/Common/Utils/ClientPriceResolver.cs \
  api/AleTrack/AleTrack.Tests/Mocks/AleTrackDbContextMockFactory.cs \
  api/AleTrack/AleTrack.Tests/Common/ClientPriceResolverTests.cs
git commit -m "feat(clients): model client-specific product prices and their resolver"
```

---

### Task 2: The migration

**Files:**
- Create: `api/AleTrack/AleTrack/Infrastructure/Persistence/Migrations/<timestamp>_AddClientProductPrices.cs` (generated)

**Interfaces:**
- Consumes: Task 1's entity and configuration.
- Produces: the `client_product_prices` table.

> **GATE — a migration is not reversible by reverting a commit.** Ask the user before running the generator, and show them the generated SQL before applying it. Do not run `dotnet ef database drop` under any circumstances.

- [ ] **Step 1: Generate the migration**

From `api/AleTrack/AleTrack/`:

```bash
dotnet ef migrations add AddClientProductPrices
```

- [ ] **Step 2: Review the generated SQL**

Read the generated `Up` method and confirm all of: table `client_product_prices`; columns `id`, `public_id`, `client_id`, `product_id`, `price_with_vat`, `set_on`; unique index on `(client_id, product_id)`; index on `product_id`; FK to `clients` with `ReferentialAction.Cascade`; FK to `products` with `ReferentialAction.Restrict`. There must be **no** `DropColumn`, `DropTable`, or rename anywhere in the file — if there is, the migration has picked up unrelated model drift; stop and report it.

- [ ] **Step 3: Apply it to the local database**

```bash
dotnet ef database update --connection "Host=localhost;Port=5433;Database=AleTrack;Username=postgres;Password=postgres"
```

If the connection fails, the local Postgres is probably not up: `docker compose up -d` from `api/AleTrack/` (port 5433, deliberately not 5432).

- [ ] **Step 4: Verify the build**

Run the `dotnet-build` skill. Expected: success.

- [ ] **Step 5: Commit**

```bash
git add api/AleTrack/AleTrack/Infrastructure/Persistence/Migrations/
git commit -m "feat(clients): add client_product_prices table"
```

---

### Task 3: List a client's prices

**Files:**
- Create: `api/AleTrack/AleTrack/Features/ClientProductPrices/ClientProductPriceDto.cs`
- Create: `api/AleTrack/AleTrack/Features/ClientProductPrices/Queries/List/GetClientProductPricesEndpoint.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/ClientProductPrices/ClientProductPriceTests.cs`

**Interfaces:**
- Consumes: Task 1's entity.
- Produces: `GET clients/{ClientId:guid}/product-prices` → `List<ClientProductPriceDto>` with `ProductId: Guid`, `ProductName: string`, `Kind: ProductKind`, `PackageSize: double?`, `BreweryId: Guid`, `BreweryName: string`, `PriceWithVat: decimal`, `ListPriceWithVat: decimal`, `SetOn: DateOnly`; `GetClientProductPricesRequest` with `ClientId: Guid`.

- [ ] **Step 1: Write the failing tests**

```csharp
[Fact]
public async Task HandleAsync_ClientWithPrices_ReturnsThemWithCatalogPriceBeside()
{
    var clientId = Guid.NewGuid();
    var client = ClientBuilder.BuildEntity(publicId: clientId);
    client.Id = 7;
    var brewery = new Brewery { Id = 3, PublicId = Guid.NewGuid(), Name = "Pivovar Frýdlant" };
    var product = new Product
    {
        Id = 11, PublicId = Guid.NewGuid(), BreweryId = 3, Brewery = brewery,
        Name = "Albrecht 12°", Kind = ProductKind.Keg, PackageSize = 30,
        PriceWithVat = 1290m, IsDeleted = false
    };
    var price = new ClientProductPrice
    {
        Id = 1, PublicId = Guid.NewGuid(), ClientId = 7, Client = client,
        ProductId = 11, Product = product, PriceWithVat = 1190m,
        SetOn = new DateOnly(2026, 3, 2)
    };

    var dbContext = AleTrackDbContextMockFactory.CreateMock(
        clients: [client], breweries: [brewery], products: [product],
        clientProductPrices: [price]);

    var endpoint = EndpointWithResponseBuilder<GetClientProductPricesRequest,
        List<ClientProductPriceDto>, GetClientProductPricesEndpoint>.Create(dbContext.Object);
    await endpoint.HandleAsync(new GetClientProductPricesRequest { ClientId = clientId }, CancellationToken.None);

    var result = endpoint.Response;
    result.Should().HaveCount(1);
    result[0].PriceWithVat.Should().Be(1190m);
    result[0].ListPriceWithVat.Should().Be(1290m);
    result[0].ProductName.Should().Be("Albrecht 12°");
    result[0].BreweryName.Should().Be("Pivovar Frýdlant");
    result[0].SetOn.Should().Be(new DateOnly(2026, 3, 2));
}

[Fact]
public async Task HandleAsync_PriceOnDeletedProduct_IsOmitted()
{
    // The row survives — product_id is Restrict and nothing benefits from deleting it —
    // but a retired product must not show up in the Ceník tab.
    var clientId = Guid.NewGuid();
    var client = ClientBuilder.BuildEntity(publicId: clientId);
    client.Id = 7;
    var brewery = new Brewery { Id = 3, PublicId = Guid.NewGuid(), Name = "B" };
    var product = new Product
    {
        Id = 11, PublicId = Guid.NewGuid(), BreweryId = 3, Brewery = brewery,
        Name = "Retired", Kind = ProductKind.Keg, PriceWithVat = 100m, IsDeleted = true
    };
    var price = new ClientProductPrice
    {
        Id = 1, PublicId = Guid.NewGuid(), ClientId = 7, Client = client,
        ProductId = 11, Product = product, PriceWithVat = 90m, SetOn = new DateOnly(2026, 1, 1)
    };

    var dbContext = AleTrackDbContextMockFactory.CreateMock(
        clients: [client], breweries: [brewery], products: [product], clientProductPrices: [price]);

    var endpoint = EndpointWithResponseBuilder<GetClientProductPricesRequest,
        List<ClientProductPriceDto>, GetClientProductPricesEndpoint>.Create(dbContext.Object);
    await endpoint.HandleAsync(new GetClientProductPricesRequest { ClientId = clientId }, CancellationToken.None);

    endpoint.Response.Should().BeEmpty();
}

[Fact]
public async Task HandleAsync_UnknownClient_Throws404()
{
    var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: []);

    var endpoint = EndpointWithResponseBuilder<GetClientProductPricesRequest,
        List<ClientProductPriceDto>, GetClientProductPricesEndpoint>.Create(dbContext.Object);

    var act = async () => await endpoint.HandleAsync(
        new GetClientProductPricesRequest { ClientId = Guid.NewGuid() }, CancellationToken.None);

    await act.Should().ThrowAsync<AleTrackException>();
}
```

- [ ] **Step 2: Run them and watch them fail**

Run `dotnet-verify` scoped to `ClientProductPriceTests`. Expected: compile failure — the endpoint does not exist.

- [ ] **Step 3: Write the DTO**

```csharp
using AleTrack.Common.Enums;

namespace AleTrack.Features.ClientProductPrices;

/// <summary>
/// One client-specific product price, with the ceník price it stands in for.
/// </summary>
public sealed record ClientProductPriceDto
{
    /// <summary>Public ID of the product</summary>
    public Guid ProductId { get; set; }

    /// <summary>Name of the product</summary>
    public string ProductName { get; set; } = null!;

    /// <summary>Kind of the product</summary>
    public ProductKind Kind { get; set; }

    /// <summary>Volume of a single container inside the package, in litres</summary>
    public double? PackageSize { get; set; }

    /// <summary>Public ID of the product's brewery</summary>
    public Guid BreweryId { get; set; }

    /// <summary>Name of the product's brewery</summary>
    public string BreweryName { get; set; } = null!;

    /// <summary>The price this client pays</summary>
    public decimal PriceWithVat { get; set; }

    /// <summary>The brewery's ceník price this stands in for</summary>
    public decimal ListPriceWithVat { get; set; }

    /// <summary>When the price was last decided</summary>
    public DateOnly SetOn { get; set; }
}
```

- [ ] **Step 4: Write the endpoint**

```csharp
using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.ClientProductPrices.Queries.List;

/// <summary>
/// Request for a client's own product prices.
/// </summary>
public sealed record GetClientProductPricesRequest
{
    /// <summary>
    /// Public ID of the client.
    /// </summary>
    public Guid ClientId { get; set; }
}

/// <summary>
/// Endpoint returning the prices a client pays instead of the ceník ones.
/// </summary>
internal sealed class GetClientProductPricesEndpoint(AleTrackDbContext dbContext)
    : Endpoint<GetClientProductPricesRequest, List<ClientProductPriceDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("clients/{clientId:guid}/product-prices");
        Description(b => b
            .RequirePermission(ModuleType.Clients, PermissionLevel.View)
            .WithName(nameof(GetClientProductPricesEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets a client's own product prices";
            s.Responses[StatusCodes.Status200OK] = "The client's price list";
            s.Responses[StatusCodes.Status404NotFound] = "Client not found";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetClientProductPricesRequest req, CancellationToken ct)
    {
        var client = await dbContext.Clients
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.PublicId == req.ClientId && !c.IsDeleted, ct);

        if (client is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(Client), req.ClientId);
        }

        var prices = await dbContext.ClientProductPrices
            .AsNoTracking()
            .Where(p => p.ClientId == client!.Id && !p.Product.IsDeleted)
            .OrderBy(p => p.Product.Brewery.Name)
            .ThenBy(p => p.Product.Name)
            .Select(p => new ClientProductPriceDto
            {
                ProductId = p.Product.PublicId,
                ProductName = p.Product.Name,
                Kind = p.Product.Kind,
                PackageSize = p.Product.PackageSize,
                BreweryId = p.Product.Brewery.PublicId,
                BreweryName = p.Product.Brewery.Name,
                PriceWithVat = p.PriceWithVat,
                ListPriceWithVat = p.Product.PriceWithVat,
                SetOn = p.SetOn
            })
            .ToListAsync(ct);

        await Send.OkAsync(prices, cancellation: ct);
    }
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run `dotnet-verify` scoped to `ClientProductPriceTests`. Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add api/AleTrack/AleTrack/Features/ClientProductPrices/ \
  api/AleTrack/AleTrack.Tests/Features/ClientProductPrices/
git commit -m "feat(clients): list a client's own product prices"
```

---

### Task 4: Save and remove one price

**Files:**
- Create: `api/AleTrack/AleTrack/Features/ClientProductPrices/Commands/SaveClientProductPriceDto.cs`
- Create: `api/AleTrack/AleTrack/Features/ClientProductPrices/Commands/Save/SaveClientProductPriceEndpoint.cs`
- Create: `api/AleTrack/AleTrack/Features/ClientProductPrices/Commands/Save/SaveClientProductPriceValidator.cs`
- Create: `api/AleTrack/AleTrack/Features/ClientProductPrices/Commands/Delete/DeleteClientProductPriceEndpoint.cs`
- Modify: `api/AleTrack/AleTrack/Common/Utils/ErrorCodes.cs` (add the validation codes — match the file's existing nesting)
- Test: `api/AleTrack/AleTrack.Tests/Features/ClientProductPrices/ClientProductPriceTests.cs` (extend)

**Interfaces:**
- Consumes: Task 1's entity, Task 3's slice folder.
- Produces: `PUT clients/{ClientId:guid}/product-prices/{ProductId:guid}` (upsert, 204) via `SaveClientProductPriceRequest { ClientId: Guid, ProductId: Guid, Data: SaveClientProductPriceDto }`; `SaveClientProductPriceDto { PriceWithVat: decimal }`; `DELETE clients/{ClientId:guid}/product-prices/{ProductId:guid}` (204) via `DeleteClientProductPriceRequest { ClientId: Guid, ProductId: Guid }`; error code `ClientProductPrices.PriceMustBePositive`.

> The compound route is a deliberate deviation from `ClientDeliveryPlaces`, which keys writes off the row's own `PublicId`. The pair *is* the key here and an upsert has no row id to address before the row exists. Say so in the endpoint's XML doc so a reviewer reads it as a decision.

- [ ] **Step 1: Write the failing tests**

```csharp
[Fact]
public async Task HandleAsync_SaveNewPrice_CreatesRowStampedToday()
{
    var clientId = Guid.NewGuid();
    var productId = Guid.NewGuid();
    var client = ClientBuilder.BuildEntity(publicId: clientId);
    client.Id = 7;
    var product = new Product { Id = 11, PublicId = productId, Name = "P", PriceWithVat = 1290m };
    var dbContext = AleTrackDbContextMockFactory.CreateMock(
        clients: [client], products: [product], clientProductPrices: []);

    var endpoint = EndpointBuilder<SaveClientProductPriceRequest, SaveClientProductPriceEndpoint>
        .Create(dbContext.Object, TimeProvider.System);
    await endpoint.HandleAsync(new SaveClientProductPriceRequest
    {
        ClientId = clientId,
        ProductId = productId,
        Data = new SaveClientProductPriceDto { PriceWithVat = 1190m }
    }, CancellationToken.None);

    dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
}

[Fact]
public async Task HandleAsync_SaveExistingPrice_OverwritesItAndRestampsSetOn()
{
    var clientId = Guid.NewGuid();
    var productId = Guid.NewGuid();
    var client = ClientBuilder.BuildEntity(publicId: clientId);
    client.Id = 7;
    var product = new Product { Id = 11, PublicId = productId, Name = "P", PriceWithVat = 1290m };
    var existing = new ClientProductPrice
    {
        Id = 1, PublicId = Guid.NewGuid(), ClientId = 7, Client = client,
        ProductId = 11, Product = product, PriceWithVat = 1190m,
        SetOn = new DateOnly(2020, 1, 1)
    };
    var dbContext = AleTrackDbContextMockFactory.CreateMock(
        clients: [client], products: [product], clientProductPrices: [existing]);

    var endpoint = EndpointBuilder<SaveClientProductPriceRequest, SaveClientProductPriceEndpoint>
        .Create(dbContext.Object, TimeProvider.System);
    await endpoint.HandleAsync(new SaveClientProductPriceRequest
    {
        ClientId = clientId,
        ProductId = productId,
        Data = new SaveClientProductPriceDto { PriceWithVat = 1150m }
    }, CancellationToken.None);

    existing.PriceWithVat.Should().Be(1150m);
    existing.SetOn.Should().NotBe(new DateOnly(2020, 1, 1));
}

[Fact]
public async Task HandleAsync_SaveForUnknownProduct_Throws404()
{
    var clientId = Guid.NewGuid();
    var client = ClientBuilder.BuildEntity(publicId: clientId);
    client.Id = 7;
    var dbContext = AleTrackDbContextMockFactory.CreateMock(
        clients: [client], products: [], clientProductPrices: []);

    var endpoint = EndpointBuilder<SaveClientProductPriceRequest, SaveClientProductPriceEndpoint>
        .Create(dbContext.Object, TimeProvider.System);

    var act = async () => await endpoint.HandleAsync(new SaveClientProductPriceRequest
    {
        ClientId = clientId,
        ProductId = Guid.NewGuid(),
        Data = new SaveClientProductPriceDto { PriceWithVat = 1m }
    }, CancellationToken.None);

    await act.Should().ThrowAsync<AleTrackException>();
}

[Fact]
public async Task HandleAsync_DeletePrice_RemovesTheRow()
{
    var clientId = Guid.NewGuid();
    var productId = Guid.NewGuid();
    var client = ClientBuilder.BuildEntity(publicId: clientId);
    client.Id = 7;
    var product = new Product { Id = 11, PublicId = productId, Name = "P", PriceWithVat = 1290m };
    var existing = new ClientProductPrice
    {
        Id = 1, PublicId = Guid.NewGuid(), ClientId = 7, Client = client,
        ProductId = 11, Product = product, PriceWithVat = 1190m, SetOn = new DateOnly(2026, 1, 1)
    };
    var dbContext = AleTrackDbContextMockFactory.CreateMock(
        clients: [client], products: [product], clientProductPrices: [existing]);

    var endpoint = EndpointBuilder<DeleteClientProductPriceRequest, DeleteClientProductPriceEndpoint>
        .Create(dbContext.Object);
    await endpoint.HandleAsync(new DeleteClientProductPriceRequest
    {
        ClientId = clientId,
        ProductId = productId
    }, CancellationToken.None);

    dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
}

[Fact]
public void Validate_NonPositivePrice_FailsWithCorrectCode()
{
    var result = new SaveClientProductPriceValidator().TestValidate(new SaveClientProductPriceRequest
    {
        ClientId = Guid.NewGuid(),
        ProductId = Guid.NewGuid(),
        Data = new SaveClientProductPriceDto { PriceWithVat = 0m }
    });

    result.ShouldHaveValidationErrorFor(x => x.Data.PriceWithVat)
        .WithErrorCode(ErrorCodes.ClientProductPrices.PriceMustBePositive);
}
```

- [ ] **Step 2: Run them and watch them fail**

Run `dotnet-verify` scoped to `ClientProductPriceTests`. Expected: compile failure.

- [ ] **Step 3: Write the DTO, validator and error code**

```csharp
namespace AleTrack.Features.ClientProductPrices.Commands;

/// <summary>
/// Body of a client product price write. Only the price with VAT is entered; the other
/// three price fields are derived from the product's own ratios at read time.
/// </summary>
public sealed record SaveClientProductPriceDto
{
    /// <summary>The price this client pays, with VAT</summary>
    public decimal PriceWithVat { get; set; }
}
```

Error code, in the existing `ErrorCodes` static class:

```csharp
/// <summary>
/// Error codes for client product prices.
/// </summary>
public static class ClientProductPrices
{
    /// <summary>A price must be greater than zero.</summary>
    public const string PriceMustBePositive = "ClientProductPrices.PriceMustBePositive";
}
```

Validator:

```csharp
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.ClientProductPrices.Commands.Save;

/// <summary>
/// Validates a client product price write.
/// </summary>
internal sealed class SaveClientProductPriceValidator : Validator<SaveClientProductPriceRequest>
{
    /// <summary>
    /// Sets up the rules.
    /// </summary>
    public SaveClientProductPriceValidator()
    {
        RuleFor(x => x.Data.PriceWithVat)
            .GreaterThan(0m)
            .WithErrorCode(ErrorCodes.ClientProductPrices.PriceMustBePositive);
    }
}
```

- [ ] **Step 4: Write the upsert endpoint**

```csharp
using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.ClientProductPrices.Commands.Save;

/// <summary>
/// Request to set the price a client pays for one product.
/// </summary>
public sealed record SaveClientProductPriceRequest
{
    /// <summary>Public ID of the client</summary>
    public Guid ClientId { get; set; }

    /// <summary>Public ID of the product</summary>
    public Guid ProductId { get; set; }

    /// <summary>Body of the request</summary>
    [FromBody]
    public SaveClientProductPriceDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint setting the price a client pays for one product.
/// </summary>
/// <remarks>
/// An upsert on the compound (client, product) route rather than a write against the
/// row's own public id, which is how <c>ClientDeliveryPlaces</c> does it: the pair is
/// the key here, and an upsert has no row id to address before the row exists.
/// </remarks>
internal sealed class SaveClientProductPriceEndpoint(AleTrackDbContext dbContext, TimeProvider timeProvider)
    : Endpoint<SaveClientProductPriceRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("clients/{clientId:guid}/product-prices/{productId:guid}");
        Description(b => b
            .RequirePermission(ModuleType.Clients, PermissionLevel.Edit)
            .WithName(nameof(SaveClientProductPriceEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Sets the price a client pays for one product";
            s.Responses[StatusCodes.Status204NoContent] = "Price saved";
            s.Responses[StatusCodes.Status404NotFound] = "Client or product not found";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SaveClientProductPriceRequest req, CancellationToken ct)
    {
        var client = await dbContext.Clients
            .FirstOrDefaultAsync(c => c.PublicId == req.ClientId && !c.IsDeleted, ct);

        if (client is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(Client), req.ClientId);
        }

        var product = await dbContext.Products
            .FirstOrDefaultAsync(p => p.PublicId == req.ProductId && !p.IsDeleted, ct);

        if (product is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(Product), req.ProductId);
        }

        var existing = await dbContext.ClientProductPrices
            .FirstOrDefaultAsync(p => p.ClientId == client!.Id && p.ProductId == product!.Id, ct);

        var today = DateOnly.FromDateTime(timeProvider.GetUtcNow().Date);

        if (existing is null)
        {
            dbContext.ClientProductPrices.Add(new ClientProductPrice
            {
                PublicId = Guid.NewGuid(),
                ClientId = client!.Id,
                ProductId = product!.Id,
                PriceWithVat = req.Data.PriceWithVat,
                SetOn = today
            });
        }
        else
        {
            existing.PriceWithVat = req.Data.PriceWithVat;
            existing.SetOn = today;
        }

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
```

- [ ] **Step 5: Write the delete endpoint**

```csharp
using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.ClientProductPrices.Commands.Delete;

/// <summary>
/// Request to revert a client to the ceník price for one product.
/// </summary>
public sealed record DeleteClientProductPriceRequest
{
    /// <summary>Public ID of the client</summary>
    public Guid ClientId { get; set; }

    /// <summary>Public ID of the product</summary>
    public Guid ProductId { get; set; }
}

/// <summary>
/// Endpoint removing a client's own price for one product.
/// </summary>
/// <remarks>
/// A hard delete: the row carries no information once the client is back on the ceník
/// price, and it cannot rewrite history because every invoice line froze its own
/// charged price at billing time.
/// </remarks>
internal sealed class DeleteClientProductPriceEndpoint(AleTrackDbContext dbContext)
    : Endpoint<DeleteClientProductPriceRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("clients/{clientId:guid}/product-prices/{productId:guid}");
        Description(b => b
            .RequirePermission(ModuleType.Clients, PermissionLevel.Edit)
            .WithName(nameof(DeleteClientProductPriceEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Reverts a client to the ceník price for one product";
            s.Responses[StatusCodes.Status204NoContent] = "Price removed";
            s.Responses[StatusCodes.Status404NotFound] = "Price not found";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteClientProductPriceRequest req, CancellationToken ct)
    {
        var price = await dbContext.ClientProductPrices
            .FirstOrDefaultAsync(p => p.Client.PublicId == req.ClientId
                                   && p.Product.PublicId == req.ProductId, ct);

        if (price is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(ClientProductPrice), req.ProductId);
        }

        dbContext.ClientProductPrices.Remove(price!);
        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
```

- [ ] **Step 6: Run the tests and watch them pass**

Run `dotnet-verify` scoped to `ClientProductPriceTests`. Expected: 8 passed.

- [ ] **Step 7: Commit**

```bash
git add api/AleTrack/AleTrack/Features/ClientProductPrices/ \
  api/AleTrack/AleTrack/Common/Utils/ErrorCodes.cs \
  api/AleTrack/AleTrack.Tests/Features/ClientProductPrices/
git commit -m "feat(clients): save and remove a client's product price"
```

---

### Task 5: Replace a client's whole price list in one call

The bulk editor saves the entire table under one button. Over a ~230-product catalog that is up to 230 requests if done one price at a time, and a half-failed run would leave the client's list in a state nobody chose. **This endpoint is an addition to the spec's API surface** — record it there in Task 13.

**Files:**
- Create: `api/AleTrack/AleTrack/Features/ClientProductPrices/Commands/Replace/ReplaceClientProductPricesEndpoint.cs`
- Create: `api/AleTrack/AleTrack/Features/ClientProductPrices/Commands/Replace/ReplaceClientProductPricesValidator.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/ClientProductPrices/ReplaceClientProductPricesTests.cs`

**Interfaces:**
- Consumes: Task 1's entity, Task 4's DTO and error codes.
- Produces: `PUT clients/{ClientId:guid}/product-prices` taking `ReplaceClientProductPricesRequest { ClientId: Guid, Data: List<ClientProductPriceEntryDto> }` where `ClientProductPriceEntryDto { ProductId: Guid, PriceWithVat: decimal }`. **Replace semantics:** the body is the complete desired list — entries present are upserted, prices absent from it are deleted. That is what makes "an empty input means the client pays the ceník" true end to end.

- [ ] **Step 1: Write the failing tests**

```csharp
[Fact]
public async Task HandleAsync_Replace_UpsertsPresentAndDeletesAbsent()
{
    var clientId = Guid.NewGuid();
    var keptProductId = Guid.NewGuid();
    var droppedProductId = Guid.NewGuid();
    var client = ClientBuilder.BuildEntity(publicId: clientId);
    client.Id = 7;
    var kept = new Product { Id = 11, PublicId = keptProductId, Name = "Kept", PriceWithVat = 1290m };
    var dropped = new Product { Id = 12, PublicId = droppedProductId, Name = "Dropped", PriceWithVat = 990m };
    var keptPrice = new ClientProductPrice
    {
        Id = 1, PublicId = Guid.NewGuid(), ClientId = 7, Client = client,
        ProductId = 11, Product = kept, PriceWithVat = 1190m, SetOn = new DateOnly(2020, 1, 1)
    };
    var droppedPrice = new ClientProductPrice
    {
        Id = 2, PublicId = Guid.NewGuid(), ClientId = 7, Client = client,
        ProductId = 12, Product = dropped, PriceWithVat = 900m, SetOn = new DateOnly(2020, 1, 1)
    };

    var dbContext = AleTrackDbContextMockFactory.CreateMock(
        clients: [client], products: [kept, dropped], clientProductPrices: [keptPrice, droppedPrice]);

    var endpoint = EndpointBuilder<ReplaceClientProductPricesRequest, ReplaceClientProductPricesEndpoint>
        .Create(dbContext.Object, TimeProvider.System);
    await endpoint.HandleAsync(new ReplaceClientProductPricesRequest
    {
        ClientId = clientId,
        Data = [new ClientProductPriceEntryDto { ProductId = keptProductId, PriceWithVat = 1226m }]
    }, CancellationToken.None);

    keptPrice.PriceWithVat.Should().Be(1226m);
    keptPrice.SetOn.Should().NotBe(new DateOnly(2020, 1, 1));
    dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
}

[Fact]
public async Task HandleAsync_EmptyList_RevertsTheClientToCatalogPrices()
{
    // Vyprázdnit vše then save. The symmetry with one click creating a whole
    // catalog's worth of prices is the point.
    var clientId = Guid.NewGuid();
    var client = ClientBuilder.BuildEntity(publicId: clientId);
    client.Id = 7;
    var product = new Product { Id = 11, PublicId = Guid.NewGuid(), Name = "P", PriceWithVat = 1290m };
    var price = new ClientProductPrice
    {
        Id = 1, PublicId = Guid.NewGuid(), ClientId = 7, Client = client,
        ProductId = 11, Product = product, PriceWithVat = 1190m, SetOn = new DateOnly(2026, 1, 1)
    };
    var dbContext = AleTrackDbContextMockFactory.CreateMock(
        clients: [client], products: [product], clientProductPrices: [price]);

    var endpoint = EndpointBuilder<ReplaceClientProductPricesRequest, ReplaceClientProductPricesEndpoint>
        .Create(dbContext.Object, TimeProvider.System);
    await endpoint.HandleAsync(new ReplaceClientProductPricesRequest
    {
        ClientId = clientId,
        Data = []
    }, CancellationToken.None);

    dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
}

[Fact]
public async Task HandleAsync_UnknownProductInBody_Throws404()
{
    var clientId = Guid.NewGuid();
    var client = ClientBuilder.BuildEntity(publicId: clientId);
    client.Id = 7;
    var dbContext = AleTrackDbContextMockFactory.CreateMock(
        clients: [client], products: [], clientProductPrices: []);

    var endpoint = EndpointBuilder<ReplaceClientProductPricesRequest, ReplaceClientProductPricesEndpoint>
        .Create(dbContext.Object, TimeProvider.System);

    var act = async () => await endpoint.HandleAsync(new ReplaceClientProductPricesRequest
    {
        ClientId = clientId,
        Data = [new ClientProductPriceEntryDto { ProductId = Guid.NewGuid(), PriceWithVat = 100m }]
    }, CancellationToken.None);

    await act.Should().ThrowAsync<AleTrackException>();
}

[Fact]
public void Validate_DuplicateProduct_FailsWithCorrectCode()
{
    var productId = Guid.NewGuid();
    var result = new ReplaceClientProductPricesValidator().TestValidate(
        new ReplaceClientProductPricesRequest
        {
            ClientId = Guid.NewGuid(),
            Data =
            [
                new ClientProductPriceEntryDto { ProductId = productId, PriceWithVat = 100m },
                new ClientProductPriceEntryDto { ProductId = productId, PriceWithVat = 200m }
            ]
        });

    result.ShouldHaveValidationErrorFor(x => x.Data)
        .WithErrorCode(ErrorCodes.ClientProductPrices.DuplicateProduct);
}

[Fact]
public void Validate_NonPositivePriceInBody_FailsWithCorrectCode()
{
    var result = new ReplaceClientProductPricesValidator().TestValidate(
        new ReplaceClientProductPricesRequest
        {
            ClientId = Guid.NewGuid(),
            Data = [new ClientProductPriceEntryDto { ProductId = Guid.NewGuid(), PriceWithVat = -5m }]
        });

    result.ShouldHaveValidationErrorFor("Data[0].PriceWithVat")
        .WithErrorCode(ErrorCodes.ClientProductPrices.PriceMustBePositive);
}
```

- [ ] **Step 2: Run them and watch them fail**

Run `dotnet-verify` scoped to `ReplaceClientProductPricesTests`. Expected: compile failure.

- [ ] **Step 3: Add the second error code**

In the `ErrorCodes.ClientProductPrices` class from Task 4:

```csharp
/// <summary>The same product appears twice in one write.</summary>
public const string DuplicateProduct = "ClientProductPrices.DuplicateProduct";
```

- [ ] **Step 4: Write the validator**

```csharp
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.ClientProductPrices.Commands.Replace;

/// <summary>
/// Validates a whole-list client price write.
/// </summary>
internal sealed class ReplaceClientProductPricesValidator : Validator<ReplaceClientProductPricesRequest>
{
    /// <summary>
    /// Sets up the rules.
    /// </summary>
    public ReplaceClientProductPricesValidator()
    {
        RuleFor(x => x.Data)
            .Must(entries => entries.Select(e => e.ProductId).Distinct().Count() == entries.Count)
            .WithErrorCode(ErrorCodes.ClientProductPrices.DuplicateProduct);

        RuleForEach(x => x.Data).ChildRules(entry =>
        {
            entry.RuleFor(e => e.PriceWithVat)
                .GreaterThan(0m)
                .WithErrorCode(ErrorCodes.ClientProductPrices.PriceMustBePositive);
        });
    }
}
```

- [ ] **Step 5: Write the endpoint**

```csharp
using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.ClientProductPrices.Commands.Replace;

/// <summary>
/// One entry of a whole-list client price write.
/// </summary>
public sealed record ClientProductPriceEntryDto
{
    /// <summary>Public ID of the product</summary>
    public Guid ProductId { get; set; }

    /// <summary>The price this client pays, with VAT</summary>
    public decimal PriceWithVat { get; set; }
}

/// <summary>
/// Request replacing a client's entire price list.
/// </summary>
public sealed record ReplaceClientProductPricesRequest
{
    /// <summary>Public ID of the client</summary>
    public Guid ClientId { get; set; }

    /// <summary>The complete desired list of prices</summary>
    [FromBody]
    public List<ClientProductPriceEntryDto> Data { get; set; } = [];
}

/// <summary>
/// Endpoint replacing a client's whole price list in one call.
/// </summary>
/// <remarks>
/// Replace, not merge: entries in the body are upserted and any price the body omits is
/// deleted. That is what backs the bulk editor's rule that an empty input means the
/// client pays the ceník, and it keeps one screenful of edits as one transaction rather
/// than a few hundred requests that can half-fail.
/// </remarks>
internal sealed class ReplaceClientProductPricesEndpoint(
    AleTrackDbContext dbContext,
    TimeProvider timeProvider) : Endpoint<ReplaceClientProductPricesRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("clients/{clientId:guid}/product-prices");
        Description(b => b
            .RequirePermission(ModuleType.Clients, PermissionLevel.Edit)
            .WithName(nameof(ReplaceClientProductPricesEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Replaces a client's whole price list";
            s.Responses[StatusCodes.Status204NoContent] = "Price list saved";
            s.Responses[StatusCodes.Status404NotFound] = "Client or one of the products not found";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(ReplaceClientProductPricesRequest req, CancellationToken ct)
    {
        var client = await dbContext.Clients
            .FirstOrDefaultAsync(c => c.PublicId == req.ClientId && !c.IsDeleted, ct);

        if (client is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(Client), req.ClientId);
        }

        var requestedIds = req.Data.Select(e => e.ProductId).Distinct().ToList();

        var productIdsByPublicId = await dbContext.Products
            .AsNoTracking()
            .Where(p => requestedIds.Contains(p.PublicId) && !p.IsDeleted)
            .Select(p => new { p.Id, p.PublicId })
            .ToDictionaryAsync(p => p.PublicId, p => p.Id, ct);

        var missing = requestedIds.Where(id => !productIdsByPublicId.ContainsKey(id)).ToList();
        if (missing.Count > 0)
        {
            ThrowHelper.PublicEntitiesNotFound(nameof(Product), missing);
        }

        var existing = await dbContext.ClientProductPrices
            .Where(p => p.ClientId == client!.Id)
            .ToListAsync(ct);

        var today = DateOnly.FromDateTime(timeProvider.GetUtcNow().Date);
        var desiredByProductId = req.Data.ToDictionary(e => productIdsByPublicId[e.ProductId], e => e.PriceWithVat);

        foreach (var row in existing)
        {
            if (desiredByProductId.TryGetValue(row.ProductId, out var price))
            {
                // Only restamp rows whose number actually moved: SetOn answers "when was
                // this price decided", and a no-op save must not rewrite that answer.
                if (row.PriceWithVat != price)
                {
                    row.PriceWithVat = price;
                    row.SetOn = today;
                }

                desiredByProductId.Remove(row.ProductId);
            }
            else
            {
                dbContext.ClientProductPrices.Remove(row);
            }
        }

        foreach (var (productId, price) in desiredByProductId)
        {
            dbContext.ClientProductPrices.Add(new ClientProductPrice
            {
                PublicId = Guid.NewGuid(),
                ClientId = client!.Id,
                ProductId = productId,
                PriceWithVat = price,
                SetOn = today
            });
        }

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
```

- [ ] **Step 6: Run the tests and watch them pass**

Run `dotnet-verify` scoped to `ReplaceClientProductPricesTests`. Expected: 5 passed.

- [ ] **Step 7: Commit**

```bash
git add api/AleTrack/AleTrack/Features/ClientProductPrices/Commands/Replace/ \
  api/AleTrack/AleTrack/Common/Utils/ErrorCodes.cs \
  api/AleTrack/AleTrack.Tests/Features/ClientProductPrices/ReplaceClientProductPricesTests.cs
git commit -m "feat(clients): replace a client's whole price list in one call"
```

---

### Task 6: Bill the client's price on the shipment snapshot

This is the load-bearing change: it is what makes an order actually cost the client's price, and what freezes it.

**Files:**
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Utils/ShipmentContentSnapshotWriter.cs`
- Modify: every caller of `ShipmentContentSnapshotWriter.Apply` (find them with `grep -rn "ShipmentContentSnapshotWriter.Apply" api/`)
- Test: `api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentContentSnapshotWriterTests.cs`

**Interfaces:**
- Consumes: `ClientPriceList` from Task 1.
- Produces: `ShipmentContentSnapshotWriter.Apply(OutgoingShipment shipment, IReadOnlyDictionary<long, ClientPriceList> priceListsByClientId)`. The writer stays DbContext-free — callers load the lists and hand them in. `Clear` is unchanged.

- [ ] **Step 1: Write the failing tests**

```csharp
[Fact]
public void Apply_ClientWithOwnPrice_SnapshotsThatPriceNotTheCatalogOne()
{
    var shipment = /* build a shipment with one order stop for client id 7,
                      carrying product id 11 priced 1290 in the catalog */;
    var priceLists = new Dictionary<long, ClientPriceList>
    {
        [7] = new(new Dictionary<long, decimal> { [11] = 1190m })
    };

    ShipmentContentSnapshotWriter.Apply(shipment, priceLists);

    shipment.Stops[0].Items[0].UnitPriceWithVat.Should().Be(1190m);
}

[Fact]
public void Apply_ClientWithoutOwnPrice_SnapshotsTheCatalogPrice()
{
    var shipment = /* same shipment */;

    ShipmentContentSnapshotWriter.Apply(shipment, new Dictionary<long, ClientPriceList>());

    shipment.Stops[0].Items[0].UnitPriceWithVat.Should().Be(1290m);
}

[Fact]
public void Apply_RepricedAfterLoading_LeavesTheSnapshotAlone()
{
    // The freeze: re-running Apply is how a run rebuilds its snapshot, but a shipment
    // that is already Loaded is never re-applied, so the billed number cannot move.
    var shipment = /* same shipment */;
    ShipmentContentSnapshotWriter.Apply(shipment, new Dictionary<long, ClientPriceList>
    {
        [7] = new(new Dictionary<long, decimal> { [11] = 1190m })
    });

    var billed = shipment.Stops[0].Items[0].UnitPriceWithVat;

    // Someone reprices the client afterwards; the snapshot row is untouched because
    // nothing re-reads the rule for a loaded run.
    billed.Should().Be(1190m);
}
```

Replace the `/* … */` placeholders with the fixture the existing test file already uses — read `ShipmentContentSnapshotWriterTests.cs` first and follow its builder calls exactly rather than inventing new ones.

- [ ] **Step 2: Run them and watch them fail**

Run `dotnet-verify` scoped to `ShipmentContentSnapshotWriterTests`. Expected: compile failure on the new `Apply` signature.

- [ ] **Step 3: Change the writer**

`Apply` takes the lookup and threads it into `Snapshot`:

```csharp
public static void Apply(
    OutgoingShipment shipment,
    IReadOnlyDictionary<long, ClientPriceList> priceListsByClientId)
{
    foreach (var stop in shipment.Stops.Where(s =>
                 s.Kind == OutgoingShipmentStopKind.Order && s.ClientOrder is not null))
    {
        var order = stop.ClientOrder!;

        stop.ClientPublicId = order.Client?.PublicId;
        stop.ClientName = order.Client?.Name;
        stop.ClientRegion = order.Client?.Region;

        // The client's own prices, or none — a stop whose client row has gone missing
        // still has to be loadable, so this degrades rather than throwing.
        var priceList = order.Client is not null
                        && priceListsByClientId.TryGetValue(order.Client.Id, out var list)
            ? list
            : ClientPriceList.Empty;

        stop.Items = [.. order.OrderItems.Select(item => Snapshot(stop, item, priceList))];
    }
}
```

and in `Snapshot`, replace the two price lines:

```csharp
var resolved = product is null ? (ResolvedPrice?)null : priceList.Resolve(product);
…
UnitPriceWithVat = resolved?.PriceWithVat ?? 0m,
UnitPriceWithoutVat = resolved?.PriceWithoutVat,
```

- [ ] **Step 4: Update the callers**

For each call site found in Step 1 of **Files**, load the price lists for the clients the shipment touches and pass them in:

```csharp
var clientIds = shipment.Stops
    .Where(s => s.ClientOrder?.Client is not null)
    .Select(s => s.ClientOrder!.Client!.Id)
    .Distinct()
    .ToList();

var priceRows = await dbContext.ClientProductPrices
    .AsNoTracking()
    .Where(p => clientIds.Contains(p.ClientId))
    .Select(p => new { p.ClientId, p.ProductId, p.PriceWithVat })
    .ToListAsync(ct);

var priceLists = priceRows
    .GroupBy(p => p.ClientId)
    .ToDictionary(
        g => g.Key,
        g => new ClientPriceList(g.ToDictionary(p => p.ProductId, p => p.PriceWithVat)));

ShipmentContentSnapshotWriter.Apply(shipment, priceLists);
```

- [ ] **Step 5: Run the full backend suite**

Run the `dotnet-verify` skill with no filter — the writer's signature change reaches several slices, and a filtered run will not prove they still compile and pass. Read the whole output.

- [ ] **Step 6: Commit**

```bash
git add api/AleTrack/AleTrack/Features/OutgoingShipments/ api/AleTrack/AleTrack.Tests/
git commit -m "feat(shipments): bill a client's own price when a run is loaded"
```

---

### Task 7: Surface prices on the reads the UI needs

**Files:**
- Modify: `api/AleTrack/AleTrack/Features/Products/Queries/List/ProductListItemDto.cs` (add `ListPriceWithVat`)
- Modify: `api/AleTrack/AleTrack/Features/Products/Queries/ClientHistory/GetProductsByClientHistoryEndpoint.cs`
- Modify: `api/AleTrack/AleTrack/Features/Orders/Queries/Detail/OrderDto.cs` (`OrderItemDto` gains prices)
- Modify: `api/AleTrack/AleTrack/Features/Orders/Queries/Detail/GetOrderDetailEndpoint.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/Products/GetProductsByClientHistoryTests.cs` (extend or create)
- Test: `api/AleTrack/AleTrack.Tests/Features/Orders/GetOrderDetailTests.cs` (extend or create — check the existing name first)

**Interfaces:**
- Consumes: `ClientPriceResolver` from Task 1.
- Produces: `ProductListItemDto.ListPriceWithVat: decimal?` (non-null only when a client price applies; always null on the global product list); `OrderItemDto.UnitPriceWithVat: decimal` and `OrderItemDto.ListPriceWithVat: decimal?`.

- [ ] **Step 1: Write the failing tests**

```csharp
[Fact]
public async Task HandleAsync_ClientHistoryForClientWithOwnPrice_ReturnsItWithListPriceBeside()
{
    // The override is applied AFTER ToListAsync — ApplyFilterAndSort runs server-side
    // against catalog prices, so resolving before it would desync the sort.
    // Assert: PriceWithVat == 1190, ListPriceWithVat == 1290.
}

[Fact]
public async Task HandleAsync_ClientHistoryForClientWithoutOwnPrice_LeavesListPriceNull()
{
    // Assert: PriceWithVat == 1290, ListPriceWithVat is null.
}

[Fact]
public async Task HandleAsync_OrderNotYetLoaded_ResolvesTheClientPriceLive()
{
    // No OutgoingShipmentStopItem for this order item.
    // Assert: item.UnitPriceWithVat == 1190, item.ListPriceWithVat == 1290.
}

[Fact]
public async Task HandleAsync_OrderAlreadyLoaded_ReadsTheFrozenSnapshotAndReportsNoListPrice()
{
    // An OutgoingShipmentStopItem exists for the order item, carrying 1150.
    // Assert: item.UnitPriceWithVat == 1150 (not today's resolved 1190), and
    // item.ListPriceWithVat is null — the snapshot never recorded what the ceník said,
    // and today's ceník beside a frozen number would mislead.
}
```

Fill each body following the fixture style of the sibling test class in the same folder; do not invent builder methods.

- [ ] **Step 2: Run them and watch them fail**

Run `dotnet-verify` scoped to the two test classes. Expected: failures on missing DTO members.

- [ ] **Step 3: Add the DTO members**

```csharp
/// <summary>
/// The brewery's ceník price, present only when this row is priced specially for a
/// client. A non-null value is the signal that <see cref="PriceWithVat"/> is not the
/// list price; on the global product list it is always null.
/// </summary>
public decimal? ListPriceWithVat { get; set; }
```

and on `OrderItemDto`:

```csharp
/// <summary>
/// Unit price with VAT: the frozen snapshot price once the order has been loaded,
/// otherwise the client's live-resolved price.
/// </summary>
public decimal UnitPriceWithVat { get; set; }

/// <summary>
/// The ceník price this stands in for. Null for snapshot-fed rows: the snapshot never
/// recorded the ceník price of the day, and today's beside a frozen one would mislead.
/// </summary>
public decimal? ListPriceWithVat { get; set; }
```

- [ ] **Step 4: Resolve in the client-history endpoint**

After the existing `ToListAsync()` and after `ApplyFilterAndSort`, resolve over the materialised list:

```csharp
var priceList = await ClientPriceResolver.LoadByPublicIdAsync(dbContext, req.ClientId, ct);

foreach (var item in items)
{
    // The projection carries the catalog price; swap in the client's where one exists.
    var resolved = priceList.Resolve(productsByPublicId[item.Id]);
    if (resolved.ListPriceWithVat is not null)
    {
        item.PriceWithVat = resolved.PriceWithVat;
        item.PriceForUnitWithVat = resolved.PriceForUnitWithVat;
        item.PriceForUnitWithoutVat = resolved.PriceForUnitWithoutVat;
        item.ListPriceWithVat = resolved.ListPriceWithVat;
    }
}
```

Load `productsByPublicId` alongside the existing query rather than re-querying per row — an N+1 here would be a regression (`rules/ef-core.md#n-plus-one`).

- [ ] **Step 5: Fill the order detail item prices**

In `GetOrderDetailEndpoint`, load the stop-item snapshot rows for the order's items and the client's price list, then fill each `OrderItemDto`: snapshot price when a row exists (with `ListPriceWithVat` left null), resolved price otherwise.

- [ ] **Step 6: Run the tests and watch them pass**

Run `dotnet-verify` scoped to the two test classes, then the full suite before committing.

- [ ] **Step 7: Commit**

```bash
git add api/AleTrack/AleTrack/Features/Products/ api/AleTrack/AleTrack/Features/Orders/ api/AleTrack/AleTrack.Tests/
git commit -m "feat(orders): show the client's price on order detail and product history"
```

---

### Task 8: Regenerate the API client

**Files:**
- Modify: `app/src/generated/api-client.ts` (generated — never hand-edited)

- [ ] **Step 1: Start the backend on 8080**

From `api/AleTrack/`:

```bash
dotnet run --project AleTrack --launch-profile Local
```

**Check what is actually on 8080 before trusting the output.** `generate-api` silently regenerates against whatever holds that port, and another project's backend has taken it before; the swagger `servers` URL also leaks into `baseUrl`. Confirm `http://localhost:8080/swagger/v1/swagger.json` mentions `ClientProductPrices` before generating.

- [ ] **Step 2: Regenerate**

Use the `regen-api` skill (it owns the invocation), or from `app/`: `yarn generate-api`.

- [ ] **Step 3: Confirm the new surface arrived**

```bash
grep -c "ClientProductPrice" app/src/generated/api-client.ts
```

Expected: non-zero, and `getClientProductPricesEndpoint`, `saveClientProductPriceEndpoint`, `deleteClientProductPriceEndpoint`, `replaceClientProductPricesEndpoint` all present.

- [ ] **Step 4: Typecheck**

Run the `react-build` skill. Expect failures **only** where existing code consumes changed DTOs; fix those in this task.

- [ ] **Step 5: Commit**

```bash
git add app/src/generated/api-client.ts app/src
git commit -m "chore(app): regenerate the API client for client product prices"
```

---

### Task 9: The Ceník tab

**Files:**
- Create: `app/src/hooks/useClientProductPrices.ts`
- Create: `app/src/features/clients/ProductPricesPanel.tsx`
- Create: `app/src/features/clients/ProductPricesPanel.test.tsx`
- Modify: `app/src/api/queryKeys.ts` (add `clientProductPrices`)
- Modify: `app/src/features/clients/clientDetailTab.ts` (widen `SubTab` and `SUB_TABS`)
- Modify: `app/src/features/clients/clientDetailTab.test.ts`
- Modify: `app/src/features/clients/ClientDetail.tsx` (the `Tab` and its render branch)

**Interfaces:**
- Consumes: Task 8's generated client.
- Produces: `useClientProductPrices(clientId)`, `useSaveClientProductPrice()`, `useDeleteClientProductPrice()`, `useReplaceClientProductPrices()`; `SubTab` gains `'prices'`; `ProductPricesPanel({ clientId, editable })`.

- [ ] **Step 1: Write the failing tab test**

```ts
it('narrows the prices tab and still falls back for an unknown value', () => {
  expect(clientDetailTab('prices')).toBe('prices');
  expect(clientDetailTab('nonsense')).toBe('info');
  expect(clientDetailTab(null)).toBe('info');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run the `react-verify` skill scoped to `clientDetailTab.test.ts`. Expected: FAIL — `'prices'` narrows to `'info'`.

- [ ] **Step 3: Widen the union**

```ts
export type SubTab = 'info' | 'orders' | 'prices' | 'reminders' | 'notes';

const SUB_TABS: SubTab[] = ['info', 'orders', 'prices', 'reminders', 'notes'];
```

- [ ] **Step 4: Write the query keys and hooks**

In `queryKeys.ts`, beside `clientDeliveryPlaces`:

```ts
clientProductPrices: (clientId: string) => ['clients', clientId, 'product-prices'] as const,
```

`useClientProductPrices.ts` follows `useDeliveryPlaces.ts` exactly: one `useQuery` gated on `enabled: !!clientId`, and mutations that `invalidateQueries` the client's price key. Also invalidate `qk.orders.all` — an order's displayed prices change when the client's prices do.

- [ ] **Step 5: Write the panel test**

Mock the hook so it can express loading, error and no-data (`app/CLAUDE.md` — a happy-path-only mock cannot catch a crash on a missing response). Cover: the empty state when the client has no prices; a row rendering the client price, the ceník price and the difference; the add button hidden when `editable` is false.

- [ ] **Step 6: Write the panel**

Port `clCenikView` from the prototype: grouped by brewery, columns Produkt / Cena klienta / Ceník / Rozdíl, a `StatusPill`-style difference chip, edit and delete row actions. Money through `useCurrency().formatMoney`. Czech copy: `Přidat cenu`, `Hromadná úprava cen`, `Vrátit na ceník`, `Žádné vlastní ceny`.

- [ ] **Step 7: Wire the tab into ClientDetail**

Add the `Tab` after Objednávky with a count pill via the existing `tabLabel` helper, and the `activeTab === 'prices'` render branch. No permission gate of its own — the page is already Clients-scoped.

- [ ] **Step 8: Run the tests and watch them pass**

Run `react-verify` scoped to `app/src/features/clients`. Then run it unscoped before committing.

- [ ] **Step 9: Commit**

```bash
git add app/src/hooks/useClientProductPrices.ts app/src/api/queryKeys.ts app/src/features/clients/
git commit -m "feat(app): give a client its own Ceník tab"
```

---

### Task 10: The bulk catalog editor

**Files:**
- Create: `app/src/features/clients/BulkClientPricesDrawer.tsx`
- Create: `app/src/features/clients/bulkClientPricesModel.ts`
- Create: `app/src/features/clients/bulkClientPricesModel.test.ts`
- Create: `app/src/features/clients/BulkClientPricesDrawer.test.tsx`
- Modify: `app/src/features/clients/ProductPricesPanel.tsx` (the toolbar button)

**Interfaces:**
- Consumes: Task 9's hooks, the product list query, Task 5's replace endpoint.
- Produces: `bulkClientPricesModel.ts` exporting `fillFromPercent(products, percent) → Record<string, string>`, `rowState(product, draftValue, currentPrice) → { isNew: boolean; raisesPrice: boolean; revertsToList: boolean }`, and `toReplacePayload(draft) → ClientProductPriceEntryDto[]`.

> Put the arithmetic and row-state logic in `bulkClientPricesModel.ts`, not in the component. It is the risky part, it is pure, and it is testable without a rendering harness (`app/CLAUDE.md`). Keep draft values in React state keyed by product id — not in the DOM — so filtering by search re-renders rows without discarding typed prices. That bug is real: it is why the prototype keeps `CLBP.draft` outside the inputs.

- [ ] **Step 1: Write the failing model tests**

```ts
describe('fillFromPercent', () => {
  it('fills every product from its ceník price, not from the client price', () => {
    const products = [
      { id: 'a', priceWithVat: 1290 },
      { id: 'b', priceWithVat: 480 },
    ];
    expect(fillFromPercent(products, -5)).toEqual({ a: '1226', b: '456' });
  });

  it('is idempotent — running it twice gives the same numbers', () => {
    const products = [{ id: 'a', priceWithVat: 1290 }];
    const once = fillFromPercent(products, -5);
    const twice = fillFromPercent(products, -5);
    expect(twice).toEqual(once);
  });

  it('treats a positive percentage as an increase', () => {
    expect(fillFromPercent([{ id: 'a', priceWithVat: 1000 }], 3)).toEqual({ a: '1030' });
  });
});

describe('rowState', () => {
  it('marks a row the client has no price for as new', () => {
    expect(rowState({ id: 'a', priceWithVat: 1290 }, '1226', undefined).isNew).toBe(true);
  });

  it('marks a row priced above what the client pays today', () => {
    expect(rowState({ id: 'a', priceWithVat: 1290 }, '1226', 1190).raisesPrice).toBe(true);
    expect(rowState({ id: 'a', priceWithVat: 1290 }, '1100', 1190).raisesPrice).toBe(false);
  });

  it('marks a cleared row as reverting to the ceník', () => {
    expect(rowState({ id: 'a', priceWithVat: 1290 }, '', 1190).revertsToList).toBe(true);
    expect(rowState({ id: 'a', priceWithVat: 1290 }, '', undefined).revertsToList).toBe(false);
  });
});

describe('toReplacePayload', () => {
  it('drops empty and non-positive entries', () => {
    expect(toReplacePayload({ a: '1226', b: '', c: '0', d: '-5' }))
      .toEqual([{ productId: 'a', priceWithVat: 1226 }]);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run `react-verify` scoped to `bulkClientPricesModel.test.ts`. Expected: FAIL — module not found.

- [ ] **Step 3: Write the model**

Round to whole crowns with `Math.round`, matching the prototype and `BulkPriceDrawer`.

- [ ] **Step 4: Run the model tests and watch them pass**

- [ ] **Step 5: Write the drawer test**

Cover: typing a price into a row and saving calls the replace mutation with exactly that entry; a percentage fill then save sends the whole catalog; **Vyprázdnit vše** then save sends an empty list; a price typed into a row that search then hides is still in the payload; the `nová` and `vyšší než dnes` marks appear. Mock the product-list and price-list hooks with loading, error and data variants.

- [ ] **Step 6: Write the drawer**

Port `clBulkPriceForm`: a wide `FormDrawer` over the whole catalog grouped by brewery, a signed percentage field, `Přepočítat náhled`, `Vyprázdnit vše`, a search field, a running count, and one `Uložit ceny` calling `useReplaceClientProductPrices()`. Add the toolbar button to `ProductPricesPanel`.

- [ ] **Step 7: Run the tests and watch them pass**

Run `react-verify` scoped to `app/src/features/clients`, then unscoped.

- [ ] **Step 8: Commit**

```bash
git add app/src/features/clients/
git commit -m "feat(app): bulk-edit a client's prices across the catalog"
```

---

### Task 11: Mark the client's price where it is spent

**Files:**
- Modify: `app/src/features/orders/OrderEditor.tsx` (catalog rows at ~`:151` and `:194`, totals at ~`:422` and `:777`)
- Modify: `app/src/features/orders/OrderDetail.tsx` (item rows gain unit price and line total)
- Modify: `app/src/features/orders/OrderDetail.test.tsx`
- Create: `app/src/components/common/PriceWithList.tsx`
- Create: `app/src/components/common/PriceWithList.test.tsx`

**Interfaces:**
- Consumes: `listPriceWithVat` from Tasks 7–8.
- Produces: `PriceWithList({ price, listPrice })` — renders the price alone when `listPrice` is null, and the price with the list price struck through beside it otherwise.

> One shared component, as the prototype's `priceCell` is: the same mark appears in the order catalog, the cart, order detail and the Ceník tab, and four near-copies would drift. Colors and spacing come from theme tokens (`theme.vars.palette.*` inside `sx` callbacks — `theme.palette.*` freezes to the light value under `cssVariables`).

- [ ] **Step 1: Write the failing component test**

```tsx
it('renders the price alone when there is no list price', () => {
  render(<PriceWithList price={1290} listPrice={null} />);
  expect(screen.queryByText(/1 290/)).toBeInTheDocument();
  expect(document.querySelector('[data-list-price]')).toBeNull();
});

it('renders the list price struck through beside a client price', () => {
  render(<PriceWithList price={1190} listPrice={1290} />);
  expect(screen.getByTestId('list-price')).toHaveStyle('text-decoration: line-through');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run `react-verify` scoped to `PriceWithList.test.tsx`. Expected: FAIL — module not found.

- [ ] **Step 3: Write the component, then use it**

Swap the four `OrderEditor` price sites and the `OrderDetail` item rows onto it. `OrderEditor.tsx` is already ~997 lines, well past the ~500-line guidance in `app/CLAUDE.md`; **do not** restructure it here — that is its own change. Note it in the commit body.

- [ ] **Step 4: Extend the order-detail test**

Assert the mark shows for an order still being composed and is absent once `listPriceWithVat` comes back null (a loaded order).

- [ ] **Step 5: Run the tests and watch them pass**

Run `react-verify` unscoped.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/common/PriceWithList.tsx app/src/components/common/PriceWithList.test.tsx app/src/features/orders/
git commit -m "feat(app): mark a client's own price wherever an order shows money"
```

---

### Task 12: Price the counter for a client buyer

**Files:**
- Modify: `app/src/features/sales/SaleEditor.tsx` (the line default at ~`:236`)
- Modify: `app/src/features/sales/SaleCatalog.tsx` (the history-row add at ~`:462`)
- Modify: `app/src/features/sales/saleCatalogModel.ts`
- Modify: `app/src/features/sales/saleCatalogModel.test.ts`
- Modify: `app/src/features/sales/SaleCatalog.test.tsx`

**Interfaces:**
- Consumes: `useClientProductPrices` from Task 9.
- Produces: no new exports — `saleCatalogModel` gains a `clientPriceByProductId` parameter on the row-building functions.

> Resolved on the client from the same price-list query the Ceník tab uses. No inventory endpoint changes: the till already types its own prices, so this is a *default*, and the operator stays free to overwrite it.

- [ ] **Step 1: Write the failing tests**

```ts
it('offers the client price as the line default on the browse segment', () => {
  // stock row for a product the client has a price of 1190 for, ceník 1290
  // expect the built row's price to be 1190
});

it('lets the client price win over what the client last paid', () => {
  // history row carrying lastUnitPriceWithVat 999 and a client price of 1190
  // expect the add to suggest 1190, and the row to still display 999 as history
});

it('leaves a walk-in on the ceník price', () => {
  // no clientId → no prices → 1290
});
```

- [ ] **Step 2: Run them and watch them fail**

Run `react-verify` scoped to `app/src/features/sales`.

- [ ] **Step 3: Thread the client's prices through**

Load them in `SaleEditor` when `buyerKind === 'Client'` and a client is chosen; pass a `Record<productId, price>` into the catalog model; resolve the stock row's price from it; on the history path suggest the client's price instead of `lastUnitPriceWithVat` while keeping the last-paid figure visible in the row.

- [ ] **Step 4: Run the tests and watch them pass**

Run `react-verify` unscoped.

- [ ] **Step 5: Commit**

```bash
git add app/src/features/sales/
git commit -m "feat(app): price counter sales from the client's own ceník"
```

---

### Task 13: Reconcile the spec with what was built

**Files:**
- Modify: `docs/superpowers/specs/2026-07-29-client-product-prices-design.md`

- [ ] **Step 1: Record the replace endpoint**

Add `PUT clients/{ClientId:guid}/product-prices` to the API surface table with its replace semantics and the reason it exists (one screenful of bulk edits is one transaction, not a few hundred requests). The spec's table predates the bulk editor.

- [ ] **Step 2: Record the writer's new signature**

The spec says a lookup "can be passed into" `ShipmentContentSnapshotWriter`; now name the actual signature and the fact that callers load the lists.

- [ ] **Step 3: Check every claim still holds**

Re-read the spec against the built code and fix anything that has drifted — especially the line references in the UI section, which move as files change.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-07-29-client-product-prices-design.md
git commit -m "docs(clients): reconcile the client price spec with the implementation"
```

---

## Self-Review

**Spec coverage.** Data model → Task 1–2. Resolution and the formula → Task 1. Lookup-not-JOIN → Task 1 and 6. Where prices surface: snapshot writer → Task 6; `ShipmentInvoicing` → inherits, no task needed; client history → Task 7; order detail → Task 7 and 11; counter sales → Task 12; brewery Ceník → unchanged by design; reports → unchanged by design. Freeze semantics → Task 6 and 7. API surface → Task 3–5. DTO changes → Task 7–8. Ceník tab → Task 9. Bulk editing → Task 10. OrderEditor → Task 11. Testing → each task's own steps.

**Gaps found and closed while reviewing.** The spec's API surface had no batch write, so the bulk editor it describes would have needed one request per product — Task 5 adds `PUT …/product-prices` and Task 13 records it. `set_on` had no writer in the spec's endpoint list; Tasks 4 and 5 stamp it, and Task 5 deliberately does not restamp an unchanged row, since `SetOn` answers "when was this decided".

**Known deviation carried forward.** Endpoints are `internal sealed` per the spec's decision, which differs from the `public sealed` of the `ClientDeliveryPlaces` slice they otherwise mirror. `InternalsVisibleTo AleTrack.Tests` (`AleTrack.csproj:48`) makes them testable.

**Not in this plan.** The staleness marker UI (spec: out of scope; the `set_on` column ships without a reader). Splitting `OrderEditor.tsx`. Percentage or brewery-wide overrides as stored rules.
