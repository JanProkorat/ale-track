# Garážový prodej Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record walk-in counter sales of stock, and make completing one the third writer of the inventory ledger.

**Architecture:** A `Sale` aggregate with snapshotted `SaleItem` lines, living as a vertical slice at `Features/Sales/`. A sale is created and edited freely in `Draft`; a dedicated `CompleteSaleEndpoint` is the only path that decrements `inventory_items.quantity`, flipping state and stock in one `SaveChangesAsync`. The frontend mirrors `docs/prototype/aletrack-prototype.html#/sales` exactly.

**Tech Stack:** .NET 10, FastEndpoints, EF Core + Npgsql, xUnit + FluentAssertions + Moq.EntityFrameworkCore; React 19, MUI 7, TanStack Query 5, Vitest + happy-dom.

**Spec:** `docs/superpowers/specs/2026-08-13-garage-sales-design.md`

## Global Constraints

- Backend commands run from `api/AleTrack/`; frontend from `app/`.
- Endpoints: `internal sealed`, `DontCatchExceptions()`, `RequirePermission(ModuleType.Sales, …)`, `Description(b => b … .WithName(nameof(Endpoint)))`. No `.WithTag` — this repo does not use `IFeatureConfiguration`.
- `AsNoTracking()` on every read **except** `CompleteSaleEndpoint`, which must track to mutate.
- `DateOnly` for calendar dates, `DateTimeOffset` for timestamps. Never `DateTime`. Timestamps come from the injected `TimeProvider`.
- Guard clauses always braced, even single-statement. No intermediate `var` aliases used ≤2 times.
- XML `/// <summary>` on every public/internal member.
- Expected failures via `ThrowHelper` / `Send.*Async`; never exceptions for control flow.
- Tests named `{Method}_{StateUnderTest}_{ExpectedBehavior}`.
- Frontend: no `any`, no hardcoded colours/spacing, `theme.vars.palette.*` inside `sx` callbacks, money via `useCurrency().formatMoney`, every user string Czech via `L`/`labels.ts`, code and comments English.
- `src/generated/api-client.ts` is generated — never hand-edited.

---

### Task 1: Domain types, entities and migration

**Files:**
- Create: `api/AleTrack/AleTrack/Common/Enums/SaleState.cs`, `SaleBuyerKind.cs`, `SalePaymentMethod.cs`
- Create: `api/AleTrack/AleTrack/Entities/Sale.cs`, `SaleItem.cs`, `SaleBillingDetails.cs`
- Modify: `api/AleTrack/AleTrack/Common/Enums/ModuleType.cs` (append `Sales`)
- Modify: `api/AleTrack/AleTrack/Infrastructure/Persistence/AleTrackDbContext.cs` (two `DbSet`s)
- Modify: `api/AleTrack/AleTrack.Tests/Mocks/AleTrackDbContextMockFactory.cs` (two params)

**Interfaces:**
- Consumes: nothing.
- Produces: `Sale` (with `Items`, `State`, `BuyerKind`, `ClientId`, `BuyerName`, `Payment`, `Billing`, `SaleDate`, `CompletedAt`, `SoldByUserId`, `Note`), `SaleItem` (`SaleId`, `InventoryItemId`, `ProductId`, `Name`, `PackageSize`, `Quantity`, `UnitPriceWithVat`, `ListPriceWithVat`), `SaleBillingDetails`, `ModuleType.Sales`, `dbContext.Sales`, `dbContext.SaleItems`, and `AleTrackDbContextMockFactory.CreateMock(sales:, saleItems:)`.

- [ ] **Step 1: Add the three enums**

```csharp
namespace AleTrack.Common.Enums;

/// <summary>
/// Lifecycle of a garage sale. Stock moves on the transition to <see cref="Completed"/>.
/// </summary>
public enum SaleState
{
    /// <summary>Being assembled at the counter; inventory untouched.</summary>
    Draft,

    /// <summary>Handed over; the sold pieces have been deducted from inventory and the record is frozen.</summary>
    Completed
}
```

`SaleBuyerKind` → `Client`, `Walkin`. `SalePaymentMethod` → `Cash`, `Invoice`. Same doc-comment shape.

- [ ] **Step 2: Append `Sales` to `ModuleType`**

Append **after** `Reports` — the values are persisted in `user_module_permissions`, so reordering rewrites existing rows.

```csharp
    /// <summary>Reporty (read-only analytics).</summary>
    Reports,

    /// <summary>Garážový prodej (walk-in counter sales).</summary>
    Sales
}
```

- [ ] **Step 3: Add `SaleBillingDetails` as an owned type**

All parts nullable except what the validator enforces — a walk-in invoice is often a name plus an IČO and nothing else, which is why the existing `Address` (whose street/city/zip are `[Required]`) is not reused.

```csharp
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Billing details captured for a sale paid by invoice. The invoice document itself is
/// issued in the accounting software; this only records what it is issued to and whether
/// it has been paid.
/// </summary>
[Owned]
public class SaleBillingDetails
{
    /// <summary>Name or company name the invoice is issued to.</summary>
    [MaxLength(100)]
    [Column("billing_name")]
    public string? Name { get; set; }

    /// <summary>IČO.</summary>
    [MaxLength(20)]
    [Column("billing_company_id")]
    public string? CompanyId { get; set; }

    /// <summary>DIČ.</summary>
    [MaxLength(20)]
    [Column("billing_vat_id")]
    public string? VatId { get; set; }

    /// <summary>Street name.</summary>
    [MaxLength(50)]
    [Column("billing_street_name")]
    public string? StreetName { get; set; }

    /// <summary>Street number.</summary>
    [MaxLength(50)]
    [Column("billing_street_number")]
    public string? StreetNumber { get; set; }

    /// <summary>City.</summary>
    [MaxLength(50)]
    [Column("billing_city")]
    public string? City { get; set; }

    /// <summary>Zip code.</summary>
    [MaxLength(50)]
    [Column("billing_zip")]
    public string? Zip { get; set; }

    /// <summary>Payment due date.</summary>
    [Column("billing_due_date")]
    public DateOnly? DueDate { get; set; }

    /// <summary>Whether the invoice has been paid.</summary>
    [Column("billing_is_paid")]
    public bool IsPaid { get; set; }

    /// <summary>When it was paid.</summary>
    [Column("billing_paid_date")]
    public DateOnly? PaidDate { get; set; }
}
```

- [ ] **Step 4: Add `Sale`**

```csharp
[Table("sales")]
public sealed class Sale : PublicEntity
{
    /// <summary>Date the goods changed hands.</summary>
    [Column("sale_date")]
    public required DateOnly SaleDate { get; set; }

    /// <summary>Lifecycle state. Stock is deducted on the move to Completed.</summary>
    [Column("state")]
    public required SaleState State { get; set; }

    /// <summary>Whether the buyer is an existing client or a one-off walk-in.</summary>
    [Column("buyer_kind")]
    public required SaleBuyerKind BuyerKind { get; set; }

    /// <summary>
    /// ID of the buying <see cref="Entities.Client"/>. Non-null exactly when
    /// <see cref="BuyerKind"/> is <see cref="SaleBuyerKind.Client"/>.
    /// </summary>
    [Column("client_id")]
    public long? ClientId { get; set; }

    /// <summary>
    /// Free-text buyer name for a walk-in. Optional even then — an anonymous cash sale
    /// needs no name at all.
    /// </summary>
    [MaxLength(100)]
    [Column("buyer_name")]
    public string? BuyerName { get; set; }

    /// <summary>How the sale is paid for.</summary>
    [Column("payment")]
    public required SalePaymentMethod Payment { get; set; }

    /// <summary>Billing details; null for a cash sale.</summary>
    public SaleBillingDetails? Billing { get; set; }

    /// <summary>Free-form note about the sale.</summary>
    [MaxLength(500)]
    [Column("note")]
    public string? Note { get; set; }

    /// <summary>When the sale was completed and the stock deducted.</summary>
    [Column("completed_at")]
    public DateTimeOffset? CompletedAt { get; set; }

    /// <summary>ID of the user who rang the sale up.</summary>
    [Column("sold_by_user_id")]
    public long? SoldByUserId { get; set; }

    /// <summary>
    /// The buying client. Restrict, not Cascade: a client who has bought something cannot
    /// be deleted out from under the sales history — same reasoning as OrderItem.Product.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Restrict)]
    public Client? Client { get; set; }

    /// <summary>The user who rang the sale up. SetNull so removing an account keeps the sale.</summary>
    [DeleteBehavior(DeleteBehavior.SetNull)]
    public User? SoldByUser { get; set; }

    /// <summary>Lines sold.</summary>
    public List<SaleItem> Items { get; set; } = [];
}
```

Add `[Index(nameof(ClientId))]`, `[Index(nameof(State))]`, `[Index(nameof(SaleDate))]` above the class.

- [ ] **Step 5: Add `SaleItem`**

Snapshot columns follow `OutgoingShipmentStopItem` — the line must stay readable after a product is retired or the ceník moves.

```csharp
[Table("sale_items")]
[Index(nameof(SaleId))]
[Index(nameof(InventoryItemId))]
public sealed class SaleItem : PublicEntity
{
    /// <summary>ID of the owning <see cref="Entities.Sale"/>.</summary>
    [Column("sale_id")]
    public long SaleId { get; set; }

    /// <summary>ID of the stock row this line draws from. Null once that row is gone.</summary>
    [Column("inventory_item_id")]
    public long? InventoryItemId { get; set; }

    /// <summary>ID of the sold <see cref="Entities.Product"/>. Provenance only — display uses the snapshot.</summary>
    [Column("product_id")]
    public long? ProductId { get; set; }

    /// <summary>Item name as it was when sold.</summary>
    [MaxLength(100)]
    [Column("name")]
    public required string Name { get; set; }

    /// <summary>Container volume in litres as it was when sold.</summary>
    [Column("package_size")]
    public double? PackageSize { get; set; }

    /// <summary>Pieces sold.</summary>
    [Column("quantity")]
    public required int Quantity { get; set; }

    /// <summary>Price per piece actually charged, with VAT.</summary>
    [Column("unit_price_with_vat")]
    public required decimal UnitPriceWithVat { get; set; }

    /// <summary>
    /// Ceník price per piece with VAT at the time of sale. Null for a free-form stock item,
    /// which has no ceník entry. Kept alongside the charged price so a discount stays visible.
    /// </summary>
    [Column("list_price_with_vat")]
    public decimal? ListPriceWithVat { get; set; }

    /// <summary>The owning sale.</summary>
    public Sale Sale { get; set; } = null!;

    /// <summary>Provenance link to the stock row. Null once it is gone.</summary>
    [DeleteBehavior(DeleteBehavior.SetNull)]
    public InventoryItem? InventoryItem { get; set; }

    /// <summary>Provenance link to the product. Null once it is hard-deleted.</summary>
    [DeleteBehavior(DeleteBehavior.SetNull)]
    public Product? Product { get; set; }
}
```

- [ ] **Step 6: Register the DbSets**

In `AleTrackDbContext`, next to `InventoryItems`:

```csharp
    /// <summary>Garage sales.</summary>
    public DbSet<Sale> Sales => Set<Sale>();

    /// <summary>Lines of garage sales.</summary>
    public DbSet<SaleItem> SaleItems => Set<SaleItem>();
```

- [ ] **Step 7: Extend the test mock factory**

Add `ICollection<Sale>? sales = null` and `ICollection<SaleItem>? saleItems = null` as the **last** two optional parameters of `CreateMock`, thread them through `SetupDbContextMock`, and add the two `ReturnsDbSet` lines. Per `aletrack-endpoint-test-harness-traps`, appending keeps every existing named-argument call site compiling.

- [ ] **Step 8: Build**

Run: `dotnet build AleTrack.sln`
Expected: succeeds. Nothing consumes the new types yet.

- [ ] **Step 9: Generate the migration**

Run from `api/AleTrack/AleTrack/`: `dotnet ef migrations add AddSales`
Then **read the generated SQL** and confirm: two `CreateTable`s, ten `billing_*` columns on `sales`, the five indexes, FKs `client_id`→Restrict, `sold_by_user_id`→SetNull, `sale_id`→Cascade, `inventory_item_id`/`product_id`→SetNull, and **no destructive operation on any existing table**.

- [ ] **Step 10: Run the suite**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj`
Expected: the pre-existing count passes (829 at the time of writing), nothing broken by the enum append.

---

### Task 2: Error codes

**Files:**
- Modify: `api/AleTrack/AleTrack/Common/Utils/ErrorCodes.cs`

**Interfaces:**
- Produces: `ErrorCodes.SaleBuyerFieldsMismatch`, `SaleBillingNameRequired`, `SaleAlreadyCompleted`, `SaleLinePriceMissing`, `SaleInsufficientStock`.

- [ ] **Step 1: Append the five codes**

```csharp
    /// <summary>Buyer fields do not match the declared buyer kind.</summary>
    public const string SaleBuyerFieldsMismatch = "SALE_BUYER_FIELDS_MISMATCH";

    /// <summary>An invoice sale needs a billing name.</summary>
    public const string SaleBillingNameRequired = "SALE_BILLING_NAME_REQUIRED";

    /// <summary>The sale is completed and can no longer be changed.</summary>
    public const string SaleAlreadyCompleted = "SALE_ALREADY_COMPLETED";

    /// <summary>A line has no price and the sale cannot be completed.</summary>
    public const string SaleLinePriceMissing = "SALE_LINE_PRICE_MISSING";

    /// <summary>Not enough stock to complete the sale.</summary>
    public const string SaleInsufficientStock = "SALE_INSUFFICIENT_STOCK";
```

- [ ] **Step 2: Build**

Run: `dotnet build AleTrack.sln` — Expected: succeeds.

---

### Task 3: Create endpoint

**Files:**
- Create: `Features/Sales/Commands/Create/CreateSaleEndpoint.cs`, `CreateSaleDto.cs`, `SaleItemDto.cs`, `SaleBillingDto.cs`, `CreateSaleValidator.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/Sales/CreateSaleTests.cs`

**Interfaces:**
- Consumes: Task 1 entities, Task 2 error codes.
- Produces: `CreateSaleRequest { [FromBody] CreateSaleDto Data }`; `CreateSaleDto { DateOnly SaleDate; SaleBuyerKind BuyerKind; Guid? ClientId; string? BuyerName; SalePaymentMethod Payment; SaleBillingDto? Billing; string? Note; List<SaleItemDto> Items }`; `SaleItemDto { Guid InventoryItemId; int Quantity; decimal? UnitPriceWithVat }`; `SaleBillingDto` mirroring `SaleBillingDetails` minus `IsPaid`/`PaidDate`. Returns the new `PublicId`.

The DTO carries `InventoryItemId` and quantity/price only — **name, package size and list price are snapshotted server-side** from the stock row, so a client cannot mislabel or misprice a line's provenance. `UnitPriceWithVat` is nullable at create time (a draft may be saved before the price is agreed) and enforced at completion.

- [ ] **Step 1: Write the failing tests**

```csharp
[Fact]
public async Task HandleAsync_WalkinCashSale_CreatesDraftWithSnapshottedLine()
{
    var product = ProductBuilder.BuildEntity(name: "Svijanský Rytíř");
    product.Id = 1;
    product.PriceWithVat = 1350m;
    product.PackageSize = 30;
    var stock = new InventoryItem { Id = 7, PublicId = Guid.NewGuid(), ProductId = 1, Product = product, Quantity = 11 };

    var dbContext = AleTrackDbContextMockFactory.CreateMock(
        products: [product], inventoryItems: [stock], sales: []);

    var request = new CreateSaleRequest
    {
        Data = new CreateSaleDto
        {
            SaleDate = new DateOnly(2026, 8, 13),
            BuyerKind = SaleBuyerKind.Walkin,
            BuyerName = "Josef Vrána",
            Payment = SalePaymentMethod.Cash,
            Items = [new SaleItemDto { InventoryItemId = stock.PublicId, Quantity = 2, UnitPriceWithVat = 1300m }]
        }
    };

    var endpoint = EndpointBuilder<CreateSaleRequest, CreateSaleEndpoint>.Create(dbContext.Object);
    await endpoint.HandleAsync(request, CancellationToken.None);

    dbContext.Verify(c => c.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    var added = dbContext.Object.Sales.Local.Single();
    added.State.Should().Be(SaleState.Draft);
    added.Billing.Should().BeNull();
    var line = added.Items.Single();
    line.Name.Should().Be("Svijanský Rytíř");
    line.PackageSize.Should().Be(30);
    line.UnitPriceWithVat.Should().Be(1300m);
    line.ListPriceWithVat.Should().Be(1350m, "the ceník price is snapshotted so a discount stays visible");
    line.InventoryItemId.Should().Be(7);
}

[Fact]
public async Task HandleAsync_UnknownInventoryItem_Throws()
{
    var dbContext = AleTrackDbContextMockFactory.CreateMock(inventoryItems: [], sales: []);
    var request = new CreateSaleRequest
    {
        Data = new CreateSaleDto
        {
            SaleDate = new DateOnly(2026, 8, 13),
            BuyerKind = SaleBuyerKind.Walkin,
            Payment = SalePaymentMethod.Cash,
            Items = [new SaleItemDto { InventoryItemId = Guid.NewGuid(), Quantity = 1, UnitPriceWithVat = 10m }]
        }
    };

    var endpoint = EndpointBuilder<CreateSaleRequest, CreateSaleEndpoint>.Create(dbContext.Object);
    var act = () => endpoint.HandleAsync(request, CancellationToken.None);

    (await act.Should().ThrowAsync<AleTrackException>())
        .Which.ErrorCode.Should().Be(ErrorCodes.NotfoundError);
    dbContext.Verify(c => c.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
}

[Fact]
public async Task HandleAsync_ClientBuyer_LinksClientAndPrefillsNothingElse()
{
    var client = ClientBuilder.BuildEntity(name: "Pivnice Na Rohu");
    client.Id = 4;
    var product = ProductBuilder.BuildEntity(name: "Landskron Pilsner");
    product.Id = 1;
    var stock = new InventoryItem { Id = 9, PublicId = Guid.NewGuid(), ProductId = 1, Product = product, Quantity = 5 };

    var dbContext = AleTrackDbContextMockFactory.CreateMock(
        clients: [client], products: [product], inventoryItems: [stock], sales: []);

    var request = new CreateSaleRequest
    {
        Data = new CreateSaleDto
        {
            SaleDate = new DateOnly(2026, 8, 13),
            BuyerKind = SaleBuyerKind.Client,
            ClientId = client.PublicId,
            Payment = SalePaymentMethod.Invoice,
            Billing = new SaleBillingDto { Name = "Na Rohu gastro s.r.o.", DueDate = new DateOnly(2026, 8, 27) },
            Items = [new SaleItemDto { InventoryItemId = stock.PublicId, Quantity = 1, UnitPriceWithVat = 1420m }]
        }
    };

    var endpoint = EndpointBuilder<CreateSaleRequest, CreateSaleEndpoint>.Create(dbContext.Object);
    await endpoint.HandleAsync(request, CancellationToken.None);

    var added = dbContext.Object.Sales.Local.Single();
    added.ClientId.Should().Be(4);
    added.BuyerName.Should().BeNull();
    added.Billing!.Name.Should().Be("Na Rohu gastro s.r.o.");
    added.Billing.IsPaid.Should().BeFalse();
}
```

- [ ] **Step 2: Run to verify they fail**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~CreateSaleTests"`
Expected: compile failure — `CreateSaleRequest` does not exist.

- [ ] **Step 3: Write the DTOs and validator**

`CreateSaleValidator : Validator<CreateSaleRequest>` mirrors `UpdateInventoryItemValidator`'s two-class shape (request validator + `CreateSaleDtoValidator`), enforcing:

```csharp
RuleFor(r => r.Data.Items).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
RuleForEach(r => r.Data.Items).ChildRules(i =>
{
    i.RuleFor(x => x.Quantity).GreaterThan(0).WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError);
    i.RuleFor(x => x.UnitPriceWithVat).GreaterThanOrEqualTo(0).When(x => x.UnitPriceWithVat.HasValue)
        .WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError);
});
RuleFor(r => r.Data.ClientId).NotNull().When(r => r.Data.BuyerKind == SaleBuyerKind.Client)
    .WithErrorCode(ErrorCodes.SaleBuyerFieldsMismatch);
RuleFor(r => r.Data.BuyerName).Null().When(r => r.Data.BuyerKind == SaleBuyerKind.Client)
    .WithErrorCode(ErrorCodes.SaleBuyerFieldsMismatch);
RuleFor(r => r.Data.ClientId).Null().When(r => r.Data.BuyerKind == SaleBuyerKind.Walkin)
    .WithErrorCode(ErrorCodes.SaleBuyerFieldsMismatch);
RuleFor(r => r.Data.Billing).NotNull().When(r => r.Data.Payment == SalePaymentMethod.Invoice)
    .WithErrorCode(ErrorCodes.ValidationNotNullError);
RuleFor(r => r.Data.Billing!.Name).NotEmpty().When(r => r.Data.Payment == SalePaymentMethod.Invoice)
    .WithErrorCode(ErrorCodes.SaleBillingNameRequired);
```

- [ ] **Step 4: Write the endpoint**

`Post("sales")`, `RequirePermission(ModuleType.Sales, PermissionLevel.Edit)`, `Produces<string>(201)`, `ClearDefaultProduces(200)`. `HandleAsync` resolves the client (if any) via a private `LoadClientAsync` that `ThrowHelper.PublicEntityNotFound`s, then builds lines through a private helper that loads each stock row **with its product** and snapshots name/package size/list price:

```csharp
private async Task<SaleItem> BuildLineAsync(SaleItemDto dto, CancellationToken ct)
{
    var stock = await dbContext.InventoryItems
        .Include(i => i.Product)
        .FirstOrDefaultAsync(i => i.PublicId == dto.InventoryItemId, ct);

    if (stock is null)
    {
        ThrowHelper.PublicEntityNotFound(nameof(InventoryItem), dto.InventoryItemId);
    }

    return new SaleItem
    {
        InventoryItemId = stock!.Id,
        ProductId = stock.ProductId,
        Name = stock.Product?.Name ?? stock.Name!,
        PackageSize = stock.Product?.PackageSize,
        Quantity = dto.Quantity,
        UnitPriceWithVat = dto.UnitPriceWithVat ?? 0m,
        ListPriceWithVat = stock.Product?.PriceWithVat
    };
}
```

The sale is added with `State = SaleState.Draft` and `SoldByUserId` from the current user, then `SaveChangesAsync`, then `Send.OkAsync(sale.PublicId)`.

- [ ] **Step 5: Run the tests**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~CreateSaleTests"`
Expected: 3 passed.

---

### Task 4: List and detail queries

**Files:**
- Create: `Features/Sales/Queries/List/GetSalesListEndpoint.cs`, `SaleListItemDto.cs`
- Create: `Features/Sales/Queries/Detail/GetSaleDetailEndpoint.cs`, `SaleDto.cs`, `SaleItemDetailDto.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/Sales/GetSalesListTests.cs`

**Interfaces:**
- Produces: `SaleListItemDto { Guid Id; DateOnly SaleDate; SaleState State; SaleBuyerKind BuyerKind; string? BuyerName; Guid? ClientId; string? ClientName; SalePaymentMethod Payment; bool IsPaid; DateOnly? DueDate; int TotalQuantity; decimal TotalPrice }`; `SaleDto` = the list DTO plus `Note`, `Billing`, `CompletedAt`, `SoldByUserName`, `List<SaleItemDetailDto> Items`.

`IsPaid` is flattened onto the list DTO (rather than making the client reach into `Billing`) because the list's unpaid filter and its overdue pill both key off it.

- [ ] **Step 1: Write the failing test**

```csharp
[Fact]
public async Task HandleAsync_ReturnsNewestFirstWithComputedTotals()
{
    var older = SaleWith(new DateOnly(2026, 8, 10), [(2, 100m), (1, 50m)]);
    var newer = SaleWith(new DateOnly(2026, 8, 12), [(3, 200m)]);
    var dbContext = AleTrackDbContextMockFactory.CreateMock(sales: [older, newer]);

    var endpoint = EndpointBuilder<FilterableRequest, GetSalesListEndpoint>.Create(dbContext.Object);
    await endpoint.HandleAsync(new FilterableRequest(), CancellationToken.None);

    var result = endpoint.Response;
    result.Should().HaveCount(2);
    result[0].SaleDate.Should().Be(new DateOnly(2026, 8, 12));
    result[0].TotalQuantity.Should().Be(3);
    result[0].TotalPrice.Should().Be(600m);
    result[1].TotalQuantity.Should().Be(3);
    result[1].TotalPrice.Should().Be(250m);
}
```

with a local `SaleWith(DateOnly date, (int qty, decimal price)[] lines)` helper building a `Sale` with `Items`.

- [ ] **Step 2: Run to verify it fails** — Expected: compile failure.

- [ ] **Step 3: Write the DTOs and both endpoints**

`Get("sales")` with `FilterableRequest` + `.ApplyFilterAndSort(req.Parameters)` and `.OrderByDescending(s => s.SaleDate).ThenByDescending(s => s.Id)`, projecting totals with `s.Items.Sum(...)` inside the `Select` so they are computed in SQL. `Get("sales/{id:guid}")` returns 404 via `ThrowHelper.PublicEntityNotFound` when missing. Both `AsNoTracking()`, both `PermissionLevel.View`.

- [ ] **Step 4: Run the tests** — Expected: pass.

---

### Task 5: Update, delete and mark-paid commands

**Files:**
- Create: `Features/Sales/Commands/Update/UpdateSaleEndpoint.cs`, `UpdateSaleDto.cs`, `UpdateSaleValidator.cs`
- Create: `Features/Sales/Commands/Delete/DeleteSaleEndpoint.cs`
- Create: `Features/Sales/Commands/SetPaid/SetSalePaidEndpoint.cs`, `SetSalePaidDto.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/Sales/UpdateSaleTests.cs`, `SetSalePaidTests.cs`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `UpdateSaleRequest { Guid Id; [FromBody] UpdateSaleDto Data }` (same body shape as create), `SetSalePaidRequest { Guid Id; [FromBody] SetSalePaidDto Data }` where `SetSalePaidDto { bool IsPaid; DateOnly? PaidDate }`.

- [ ] **Step 1: Write the failing tests**

```csharp
[Fact]
public async Task HandleAsync_CompletedSale_ThrowsAndDoesNotSave()
{
    var sale = new Sale
    {
        Id = 1, PublicId = Guid.NewGuid(), SaleDate = new DateOnly(2026, 8, 1),
        State = SaleState.Completed, BuyerKind = SaleBuyerKind.Walkin, Payment = SalePaymentMethod.Cash
    };
    var dbContext = AleTrackDbContextMockFactory.CreateMock(sales: [sale], inventoryItems: []);

    var request = new UpdateSaleRequest { Id = sale.PublicId, Data = ValidBody() };
    var endpoint = EndpointBuilder<UpdateSaleRequest, UpdateSaleEndpoint>.Create(dbContext.Object);
    var act = () => endpoint.HandleAsync(request, CancellationToken.None);

    (await act.Should().ThrowAsync<AleTrackException>())
        .Which.ErrorCode.Should().Be(ErrorCodes.SaleAlreadyCompleted);
    dbContext.Verify(c => c.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
}

[Fact]
public async Task HandleAsync_SwitchToCashPayment_ClearsBillingBlock()
{
    // a sale saved as Invoice then switched to Cash must not keep stale billing data
}

[Fact]
public async Task HandleAsync_CashSale_ThrowsWhenMarkedPaid()
{
    // SetSalePaid on a cash sale is meaningless — 409, not a silent no-op
}
```

Fill the second and third bodies following the first's shape; `SetSalePaidTests` asserts `sale.Billing!.IsPaid` and `PaidDate` on the happy path.

- [ ] **Step 2: Run to verify they fail** — Expected: compile failure.

- [ ] **Step 3: Write the three endpoints**

All three load the sale and guard `State == SaleState.Draft` (except mark-paid, which requires `Completed` **and** `Payment == Invoice`) via `ThrowHelper` with `ErrorCodes.SaleAlreadyCompleted`. Update rebuilds `Items` wholesale from the DTO through the same `BuildLineAsync` helper as Task 3 — extract it to `Features/Sales/Utils/SaleLineWriter.cs` so both endpoints share one snapshot path rather than two drifting copies. Update sets `Billing = null` when `Payment == Cash`.

- [ ] **Step 4: Run the tests** — Expected: pass.

---

### Task 6: Complete endpoint — the stock write-path

**Files:**
- Create: `Features/Sales/Commands/Complete/CompleteSaleEndpoint.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/Sales/CompleteSaleTests.cs`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `CompleteSaleRequest { Guid Id }`; 204 on success.

This is the load-bearing task of the whole feature. Its tests are the ones that must not be allowed to rot.

- [ ] **Step 1: Write the failing tests**

```csharp
[Fact]
public async Task HandleAsync_CompletesSale_DecrementsInventoryQuantities()
{
    var (dbContext, sale, stockA, stockB) = Fixture(stockA: 14, soldA: 4, stockB: 64, soldB: 2);

    var endpoint = EndpointBuilder<CompleteSaleRequest, CompleteSaleEndpoint>.Create(dbContext.Object);
    await endpoint.HandleAsync(new CompleteSaleRequest { Id = sale.PublicId }, CancellationToken.None);

    stockA.Quantity.Should().Be(10);
    stockB.Quantity.Should().Be(62);
    sale.State.Should().Be(SaleState.Completed);
    sale.CompletedAt.Should().NotBeNull();
    dbContext.Verify(c => c.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
}

[Fact]
public async Task HandleAsync_QuantityExceedsStock_Returns409AndDoesNotTouchInventory()
{
    var (dbContext, sale, stockA, stockB) = Fixture(stockA: 3, soldA: 4, stockB: 64, soldB: 2);

    var endpoint = EndpointBuilder<CompleteSaleRequest, CompleteSaleEndpoint>.Create(dbContext.Object);
    var act = () => endpoint.HandleAsync(new CompleteSaleRequest { Id = sale.PublicId }, CancellationToken.None);

    (await act.Should().ThrowAsync<AleTrackException>())
        .Which.ErrorCode.Should().Be(ErrorCodes.SaleInsufficientStock);
    stockA.Quantity.Should().Be(3, "a rejected completion must not decrement anything");
    stockB.Quantity.Should().Be(64, "not even the lines that would have fit");
    sale.State.Should().Be(SaleState.Draft);
    dbContext.Verify(c => c.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
}

[Fact]
public async Task HandleAsync_InventoryRowReachesZero_KeepsRow()
{
    var (dbContext, sale, stockA, _) = Fixture(stockA: 4, soldA: 4, stockB: 10, soldB: 1);

    var endpoint = EndpointBuilder<CompleteSaleRequest, CompleteSaleEndpoint>.Create(dbContext.Object);
    await endpoint.HandleAsync(new CompleteSaleRequest { Id = sale.PublicId }, CancellationToken.None);

    stockA.Quantity.Should().Be(0);
    dbContext.Object.InventoryItems.Should().Contain(stockA, "an out-of-stock product must stay visible in Sklad");
}

[Fact]
public async Task HandleAsync_AlreadyCompleted_Returns409()
{
    var (dbContext, sale, stockA, _) = Fixture(stockA: 14, soldA: 4, stockB: 64, soldB: 2);
    sale.State = SaleState.Completed;

    var endpoint = EndpointBuilder<CompleteSaleRequest, CompleteSaleEndpoint>.Create(dbContext.Object);
    var act = () => endpoint.HandleAsync(new CompleteSaleRequest { Id = sale.PublicId }, CancellationToken.None);

    (await act.Should().ThrowAsync<AleTrackException>())
        .Which.ErrorCode.Should().Be(ErrorCodes.SaleAlreadyCompleted);
    stockA.Quantity.Should().Be(14);
}

[Fact]
public async Task HandleAsync_LinePriceMissing_Returns409()
{
    var (dbContext, sale, stockA, _) = Fixture(stockA: 14, soldA: 4, stockB: 64, soldB: 2);
    sale.Items[0].UnitPriceWithVat = 0m;
    sale.Items[0].ListPriceWithVat = null; // free-form line, price never typed

    var endpoint = EndpointBuilder<CompleteSaleRequest, CompleteSaleEndpoint>.Create(dbContext.Object);
    var act = () => endpoint.HandleAsync(new CompleteSaleRequest { Id = sale.PublicId }, CancellationToken.None);

    (await act.Should().ThrowAsync<AleTrackException>())
        .Which.ErrorCode.Should().Be(ErrorCodes.SaleLinePriceMissing);
    stockA.Quantity.Should().Be(14);
}
```

`Fixture(...)` builds a `Sale` in `Draft` with two lines wired to two `InventoryItem`s (`InventoryItem` navigation populated, since the endpoint `Include`s it) and returns the mock plus the live entity references so the assertions can read the mutated quantities.

- [ ] **Step 2: Run to verify they fail** — Expected: compile failure.

- [ ] **Step 3: Write the endpoint**

```csharp
public override async Task HandleAsync(CompleteSaleRequest req, CancellationToken ct)
{
    // Tracked on purpose: the stock rows below are about to be mutated.
    var sale = await dbContext.Sales
        .Include(s => s.Items)
        .ThenInclude(i => i.InventoryItem)
        .FirstOrDefaultAsync(s => s.PublicId == req.Id, ct);

    if (sale is null)
    {
        ThrowHelper.PublicEntityNotFound(nameof(Sale), req.Id);
    }

    if (sale!.State != SaleState.Draft)
    {
        ThrowHelper.SaleAlreadyCompleted(sale.PublicId);
    }

    if (sale.Items.Any(i => i.UnitPriceWithVat <= 0m))
    {
        ThrowHelper.SaleLinePriceMissing(sale.PublicId);
    }

    // Every line is checked before any is applied: a partially-deducted sale is
    // worse than a rejected one.
    var short = sale.Items
        .Where(i => i.InventoryItem is null || i.Quantity > i.InventoryItem.Quantity)
        .Select(i => i.Name)
        .ToList();

    if (short.Count > 0)
    {
        ThrowHelper.SaleInsufficientStock(string.Join(", ", short));
    }

    foreach (var item in sale.Items)
    {
        item.InventoryItem!.Quantity -= item.Quantity;
    }

    sale.State = SaleState.Completed;
    sale.CompletedAt = timeProvider.GetUtcNow();

    await dbContext.SaveChangesAsync(ct);
    await Send.NoContentAsync(ct);
}
```

Constructor is `(AleTrackDbContext dbContext, TimeProvider timeProvider)`. Add the three `ThrowHelper` overloads alongside the existing ones. `short` is a contextual keyword — name the local `insufficientLines`.

- [ ] **Step 4: Run the tests** — Expected: 5 passed.

- [ ] **Step 5: Run the whole backend suite**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj`
Expected: all green, previous count + the new tests.

---

### Task 7: Regenerate the API client and wire frontend plumbing

**Files:**
- Modify (generated): `app/src/generated/api-client.ts`
- Modify: `app/src/auth/permissions.ts`, `app/src/lib/labels.ts`, `app/src/api/queryKeys.ts`, `app/src/routes/paths.ts`, the `AppShell` nav config
- Create: `app/src/hooks/useSales.ts`

**Interfaces:**
- Produces: `MODULE_KEYS` including `'sales'`; `L.saleState`, `L.salePayment`, `saleNumber(id)`; `qk.sales.{all,list,detail}`; `useSales`, `useSale`, `useCreateSale`, `useUpdateSale`, `useCompleteSale`, `useSetSalePaid`, `useDeleteSale`.

- [ ] **Step 1: Start the backend and regenerate**

```bash
# terminal 1, from api/AleTrack/
docker compose up -d
cd AleTrack && dotnet ef database update --connection "Host=localhost;Port=5432;Database=AleTrack;Username=postgres;Password=postgres"
ASPNETCORE_ENVIRONMENT=Development.Local dotnet run --project AleTrack --launch-profile Local
# terminal 2, from app/
yarn generate-api
```

Per `aletrack-codegen-port-trap`, confirm the diff contains only the new `Sales*` members — if it rewrites unrelated types, something else is holding :8080.

- [ ] **Step 2: Add `'sales'` to `MODULE_KEYS`**

Append after `'inventory'`. The Uživatelé permission matrix is driven from this list, so no separate edit is needed there.

- [ ] **Step 3: Add the labels**

```ts
export const L = {
  // …
  saleState: { Draft: 'Rozpracovaný', Completed: 'Dokončený' },
  salePayment: { Cash: 'Hotově', Invoice: 'Faktura' },
};
```

plus `saleNumber(id)` in `src/lib/format.ts`, identical in shape to `orderNumber` (`#` + last 6 chars upper-cased) — the API stores no sale number.

- [ ] **Step 4: Add query keys and the hook module**

`qk.sales` via the existing `resource('sales')` factory. `useSales.ts` follows `useOrders.ts`: one hook per operation, mutations invalidating `qk.sales.all`, the affected `qk.sales.detail(id)`, **and `qk.inventory.all`** — completing, deleting or editing a sale changes stock, and forgetting that leaves Sklad stale.

- [ ] **Step 5: Rename the nav group and add the item**

`Sklad` → `Garážový prodej`, items `Dovozy zboží` · `Sklad` · `Prodeje`, cart icon, route `/sales`, gated by `canSee('sales')`.

- [ ] **Step 6: Verify**

Run: `yarn --cwd app build` then `yarn --cwd app lint`
Expected: both clean. (`yarn build` is the only command that typechecks.)

---

### Task 8: Sales list screen

**Files:**
- Create: `app/src/features/sales/SalesPage.tsx`, `salesModel.ts`, `salesModel.test.ts`
- Modify: the router config

**Interfaces:**
- Consumes: Task 7's hook and labels.
- Produces: `SalesPage` serving `/sales`, `/sales/new`, `/sales/:id`, `/sales/:id/edit` by dispatching on the `view` prop and `useParams().id`; `salesModel.ts` exporting `saleTotals(sale)`, `isUnpaid(sale)`, `overdueDays(sale, today)`, `filterSales(sales, filter)`.

The pure shaping logic goes in `salesModel.ts` so the stat strip, the unpaid filter and the overdue pill are testable without a rendering harness — the `shipmentInvoiceModel.ts` precedent.

- [ ] **Step 1: Write the failing model tests**

```ts
describe('overdueDays', () => {
  it('is 0 for a paid invoice past its due date', () => {
    expect(overdueDays({ ...invoiceSale, isPaid: true, dueDate: '2026-08-01' }, '2026-08-13')).toBe(0);
  });
  it('counts whole days past the due date for an unpaid invoice', () => {
    expect(overdueDays({ ...invoiceSale, isPaid: false, dueDate: '2026-08-10' }, '2026-08-13')).toBe(3);
  });
  it('is 0 for a cash sale', () => {
    expect(overdueDays({ ...cashSale }, '2026-08-13')).toBe(0);
  });
  it('is 0 for a draft, which has not been invoiced yet', () => {
    expect(overdueDays({ ...invoiceSale, state: 'Draft', dueDate: '2026-08-01' }, '2026-08-13')).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify they fail** — Run: `yarn --cwd app vitest run src/features/sales/salesModel.test.ts` — Expected: module not found.

- [ ] **Step 3: Write `salesModel.ts`** — pure functions, no React.

- [ ] **Step 4: Run the tests** — Expected: pass.

- [ ] **Step 5: Build `SalesPage`**

`PageHeader` (eyebrow *Garážový prodej*, title *Prodeje*), the four-tile stat strip, `SegControl` filter, `DataTable` inside `QueryBoundary`, `Nový prodej` button gated on `canEdit('sales')`. A precise port of the prototype list — same columns, same chips, same wording.

- [ ] **Step 6: Verify** — Run: `yarn --cwd app build` — Expected: clean.

---

### Task 9: Sale detail screen

**Files:**
- Create: `app/src/features/sales/SaleDetail.tsx`, `CompleteSaleDialog.tsx`, `SaleDetail.test.tsx`

**Interfaces:**
- Consumes: Tasks 7–8.
- Produces: `SaleDetail({ id })`, `CompleteSaleDialog({ sale, open, onClose })`.

- [ ] **Step 1: Write the failing component tests**

```tsx
it('hides every edit affordance once the sale is completed', () => {
  renderWithSale({ ...sale, state: 'Completed' });
  expect(screen.queryByRole('button', { name: /Upravit/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Dokončit prodej/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Smazat/ })).not.toBeInTheDocument();
});

it('offers marking an unpaid invoice as paid, but not a cash sale', () => {
  renderWithSale({ ...sale, state: 'Completed', payment: 'Invoice', isPaid: false });
  expect(screen.getByRole('button', { name: /Označit jako zaplaceno/ })).toBeInTheDocument();
  renderWithSale({ ...sale, state: 'Completed', payment: 'Cash' });
  expect(screen.queryByRole('button', { name: /Označit jako zaplaceno/ })).not.toBeInTheDocument();
});
```

Mock `useSale` with loading, error and no-data variants per `app/CLAUDE.md`.

- [ ] **Step 2: Run to verify they fail** — Expected: module not found.

- [ ] **Step 3: Build `SaleDetail` and `CompleteSaleDialog`**

Banners (draft amber / vyskladněno green / po splatnosti red), line table with total row, buyer and billing cards. The dialog shows the `Skladem → Prodej → Zůstane` table with confirm disabled when any line exceeds stock.

- [ ] **Step 4: Run the tests** — Expected: pass.

---

### Task 10: Sale editor screen

**Files:**
- Create: `app/src/features/sales/SaleEditor.tsx`, `StockPickerDrawer.tsx`, `SaleEditor.test.tsx`

**Interfaces:**
- Consumes: Tasks 7–9.
- Produces: `SaleEditor({ id })` for both `/sales/new` and `/sales/:id/edit`.

- [ ] **Step 1: Write the failing tests**

```tsx
it('clamps a line quantity to the available stock', () => {
  renderEditorWithStock([{ id: 'inv-1', name: 'Albrecht 12°', quantity: 4, priceWithVat: 1290 }]);
  addFirstStockRow();
  fireEvent.change(screen.getByLabelText('Počet'), { target: { value: '99' } });
  expect(screen.getByLabelText('Počet')).toHaveValue(4);
});

it('requires a billing name before an invoice sale can be completed', () => {
  // Dokončit prodej stays disabled while Payment=Invoice and the name is empty
});
```

- [ ] **Step 2: Run to verify they fail** — Expected: module not found.

- [ ] **Step 3: Build the editor**

Items card first, then buyer, then payment, with a sticky summary rail. `StockPickerDrawer` is a `FormDrawer` listing only `quantity > 0`, grouped by pivovar plus *Ostatní*, showing `skladem N ks`. Picking a klient prefills the billing block from their fakturační adresa. `UnsavedChangesGuard` on leave.

- [ ] **Step 4: Run the tests** — Expected: pass.

- [ ] **Step 5: Full verification**

Run: `yarn --cwd app build`, `yarn --cwd app lint`, `yarn --cwd app test:run`, and `dotnet test AleTrack.Tests/AleTrack.Tests.csproj`
Expected: all four clean.

---

## Self-review

**Spec coverage.** Data model → Task 1. Permissions → Tasks 1, 7. Migration → Task 1. Endpoint table → Tasks 3–6. Validation split → Tasks 3, 5. Stock write-path → Task 6. Frontend nav/permissions/labels/data layer → Task 7. Screens → Tasks 8–10. Testing → each task's own steps plus Task 10 Step 5. Known gaps are deliberately unimplemented.

**Gap found and closed while reviewing:** the spec's `SaleItemDto` did not say who owns the snapshot. Task 3 now states it explicitly (server-side from the stock row) and Task 5 shares one `SaleLineWriter` so create and update cannot drift.

**Type consistency.** `SaleItemDto` (write) vs `SaleItemDetailDto` (read) are distinct by design; `BuildLineAsync` is introduced in Task 3 and extracted in Task 5 under one name; `overdueDays(sale, today)` keeps the same signature in Tasks 8 and 9.
