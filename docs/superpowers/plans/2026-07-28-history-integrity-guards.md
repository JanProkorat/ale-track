# History Integrity Guards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop product and brewery deletes from destroying historical order and invoice rows, and freeze the content of shipments and orders once they leave the editable state.

**Architecture:** Product gains the codebase's existing soft-delete base class, so `Remove` becomes a flag update through the DbContext interceptor already in place; `order_items.product_id` moves to `RESTRICT` as defence in depth. A new `ShipmentMutability` utility holds one content-editability predicate plus a single-step transition matrix, and a `ShipmentContentGuard` diffs a request against the stored shipment so frozen fields are rejected only when they actually differ. The order endpoint gets the mirror-image guard whose key effect is skipping the destructive `OrderItems.Clear()` rebuild.

**Tech Stack:** .NET 10, FastEndpoints, EF Core + Npgsql, xUnit + FluentAssertions + Moq.EntityFrameworkCore. Frontend: React 19, Vite 6, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-28-history-integrity-guards-design.md`

## Global Constraints

- Backend commands run from `api/AleTrack/`. Build: `dotnet build AleTrack.sln`. Test: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj`.
- Tests are pure unit tests against a mocked DbContext (`AleTrackDbContextMockFactory.CreateMock(...)`). No database is required or available.
- Code comments in **English only**. User-visible strings in the frontend are **Czech**.
- No request or response DTO shape changes in this plan, so **`yarn generate-api` must not be run** and `src/generated/api-client.ts` must not change.
- Never edit `appsettings.*.json`. Those files are already modified in the working tree; leave them alone and never stage them.
- Migrations are not auto-applied. Generate with `dotnet ef migrations add`, do not run `database update` against any remote DB.
- Run the **full** backend suite before each commit, not a filtered slice.
- Work happens on branch `feat/25-history-integrity-guards`, already created.

---

### Task 1: Product soft-delete and the cascade break

**Files:**
- Modify: `api/AleTrack/AleTrack/Entities/Product.cs:14` (base class)
- Modify: `api/AleTrack/AleTrack/Entities/OrderItem.cs:82` (delete behavior)
- Create: `api/AleTrack/AleTrack/Infrastructure/Persistence/Configurations/ProductConfiguration.cs`
- Create: `api/AleTrack/AleTrack/Infrastructure/Persistence/Migrations/<stamp>_ProductSoftDeleteAndRestrictOrderItems.cs` (generated)

**Interfaces:**
- Consumes: nothing.
- Produces: `Product.IsDeleted` (bool, from `PublicSoftlyDeletableEntity`), used by Task 2. `order_items.product_id` as `ON DELETE RESTRICT`, relied on by Task 3.

- [ ] **Step 1: Swap the base class**

In `Entities/Product.cs`, change the declaration and add the using:

```csharp
public sealed class Product : PublicSoftlyDeletableEntity
```

`PublicSoftlyDeletableEntity` already lives in `AleTrack.Entities.BaseEntities`, which `Product.cs` imports. It supplies `[Column("is_deleted")] public bool IsDeleted`.

Do **not** touch `DeleteProductEndpoint`. `AleTrackDbContext.SaveChanges`/`SaveChangesAsync` call `SoftlyDeleteBySettingFlag` (`AleTrackDbContext.cs:187-202`), which rewrites a `Deleted` entry on any `ISoftlyDeletable` into `Modified` with the flag set. The existing `Products.Remove(product)` becomes a soft delete automatically.

- [ ] **Step 2: Restrict the order-item foreign key**

In `Entities/OrderItem.cs`, annotate the `Product` navigation:

```csharp
    /// <summary>
    /// Instance of related <see cref="Product"/> entity
    /// </summary>
    /// <remarks>
    /// Restrict, not the EF default Cascade: deleting a product used to cascade into
    /// order_items and on into outgoing_shipment_invoice_lines, wiping the history of
    /// everything ever sold. The incoming side (delivery_items.product_id) was already
    /// Restrict, which is what showed the cascade had never been a deliberate choice.
    /// </remarks>
    [DeleteBehavior(DeleteBehavior.Restrict)]
    public Product Product { get; set; } = null!;
```

- [ ] **Step 3: Add the Product configuration recording the no-filter decision**

```csharp
using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

public sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        // NO global query filter, unlike ClientConfiguration. Product is reached
        // through historical rows — DeliveredLineQuery projects oi.Product.Kind and
        // PackageSize, and ShipmentInvoiceMapper reads item.Product.Name and
        // PriceWithVat. A filter would silently null those Includes for a retired
        // product, zeroing report weights and blanking invoice line names with no
        // error. Non-deleted filtering is explicit in the picker and list endpoints
        // instead. Same reasoning as ClientDeliveryPlaceConfiguration.
    }
}
```

Configurations are discovered by `ApplyConfigurationsFromAssembly` (`AleTrackDbContext.cs:165`), so no registration step is needed.

- [ ] **Step 4: Generate the migration**

Run from `api/AleTrack/AleTrack/`:

```bash
dotnet ef migrations add ProductSoftDeleteAndRestrictOrderItems
```

Expected: adds `is_deleted` to `products` with `defaultValue: false`, and drops/recreates the `fk_order_items_products_product_id` constraint with `onDelete: ReferentialAction.Restrict`.

Inspect the generated `Up` method and confirm both changes are present and that no unrelated column churn crept in from the previously-uncommitted model state.

- [ ] **Step 5: Build**

Run: `cd api/AleTrack && dotnet build AleTrack.sln`
Expected: build succeeds, 0 errors.

- [ ] **Step 6: Run the full suite**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj`
Expected: all pass. `DeleteProductTests.ProcessAsync_DeleteProduct_Success` still verifies `Products.Remove` was called once — that remains correct, because the flag rewrite happens inside the real `SaveChangesAsync`, which is mocked away in unit tests.

- [ ] **Step 7: Commit**

```bash
git add api/AleTrack/AleTrack/Entities/Product.cs \
        api/AleTrack/AleTrack/Entities/OrderItem.cs \
        api/AleTrack/AleTrack/Infrastructure/Persistence/Configurations/ProductConfiguration.cs \
        api/AleTrack/AleTrack/Infrastructure/Persistence/Migrations/
git commit -m "fix(products): retire products instead of cascading history away"
```

---

### Task 2: Filter retired products out of the selection surfaces

**Files:**
- Modify: `api/AleTrack/AleTrack/Features/Products/Queries/List/GetProductsListEndpoint.cs:42`
- Modify: `api/AleTrack/AleTrack/Features/Products/Queries/Detail/GetProductDetailEndpoint.cs:47`
- Modify: `api/AleTrack/AleTrack/Features/Products/Queries/ClientHistory/GetProductsByClientHistoryEndpoint.cs:60,88`
- Modify: `api/AleTrack/AleTrack/Features/Breweries/Queries/ProductList/GetBreweryProductsListEndpoint.cs:57`
- Modify: `api/AleTrack/AleTrack/Features/Products/Commands/Update/UpdateProductEndpoint.cs:57`
- Modify: `api/AleTrack/AleTrack/Features/Products/Commands/Delete/DeleteProductEndpoint.cs:51`
- Modify: `api/AleTrack/AleTrack/Features/Orders/Commands/Create/CreateOrderEndpoint.cs:119`
- Modify: `api/AleTrack/AleTrack/Features/Orders/Commands/Update/UpdateOrderEndpoint.cs:200`
- Modify: `api/AleTrack/AleTrack/Features/ProductDeliveries/Commands/Create/CreateProductsDeliveryEndpoint.cs:130,204`
- Modify: `api/AleTrack/AleTrack/Features/ProductDeliveries/Commands/Update/UpdateProductDeliveryEndpoint.cs:199`
- Modify: `api/AleTrack/AleTrack/Features/InventoryItems/Commands/Create/CreateInventoryItemEndpoint.cs:88`
- Modify: `api/AleTrack/AleTrack/Features/InventoryItems/Commands/Update/UpdateInventoryItemEndpoint.cs:72`
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Commands/Update/UpdateOutgoingShipmentEndpoint.cs:528`
- Test: `api/AleTrack/AleTrack.Tests/Features/Products/DeleteProductTests.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/Products/RetiredProductVisibilityTests.cs` (create)

**Deliberately NOT modified** — these resolve a product history already references, and filtering them would break a shipment carrying a retired product:
- `Features/OutgoingShipments/Commands/SetLoadingState/SetLoadingStateEndpoint.cs:128`
- `Features/OutgoingShipments/Commands/SetPurchaseInvoiceLine/SetPurchaseInvoiceLineEndpoint.cs:135`

**Interfaces:**
- Consumes: `Product.IsDeleted` from Task 1.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing visibility tests**

Create `RetiredProductVisibilityTests.cs`:

```csharp
using AleTrack.Common.Models;
using AleTrack.Entities;
using AleTrack.Features.Breweries.Queries.ProductList;
using AleTrack.Features.Products.Queries.List;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.Products;

/// <summary>
/// A retired product must vanish from every surface a user picks from, and stay
/// resolvable everywhere history already references it.
/// </summary>
public sealed class RetiredProductVisibilityTests
{
    [Fact]
    public async Task ProcessAsync_ProductsList_ExcludesRetiredProduct()
    {
        var brewery = BreweryBuilder.BuildEntity();
        var live = ProductBuilder.BuildEntity(publicId: Guid.NewGuid(), brewery: brewery);
        var retired = ProductBuilder.BuildEntity(publicId: Guid.NewGuid(), brewery: brewery);
        retired.IsDeleted = true;

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            breweries: [brewery],
            products: [live, retired]);

        var endpoint = EndpointBuilder<FilterableRequest, GetProductsListEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new FilterableRequest(), CancellationToken.None);

        endpoint.Response.Should().HaveCount(1);
        endpoint.Response.Single().Id.Should().Be(live.PublicId);
    }

    [Fact]
    public async Task ProcessAsync_BreweryProductsList_ExcludesRetiredProduct()
    {
        var brewery = BreweryBuilder.BuildEntity(publicId: Guid.NewGuid());
        var live = ProductBuilder.BuildEntity(publicId: Guid.NewGuid(), brewery: brewery);
        var retired = ProductBuilder.BuildEntity(publicId: Guid.NewGuid(), brewery: brewery);
        retired.IsDeleted = true;

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            breweries: [brewery],
            products: [live, retired]);

        var endpoint = EndpointBuilder<GetProductsListRequest, GetBreweryProductsListEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new GetProductsListRequest { Id = brewery.PublicId }, CancellationToken.None);

        endpoint.Response.Should().HaveCount(1);
        endpoint.Response.Single().Id.Should().Be(live.PublicId);
    }
}
```

Adjust the builder call signatures to whatever `ProductBuilder.BuildEntity` and `BreweryBuilder.BuildEntity` actually accept — read them first (`AleTrack.Tests/Builders/ProductBuilder.cs`). If `EndpointBuilder` exposes the response differently from `endpoint.Response`, follow the pattern already used in `GetProductsByClientHistoryTests.cs`.

- [ ] **Step 2: Run them to verify they fail**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~RetiredProductVisibilityTests"`
Expected: both FAIL, each returning 2 products instead of 1.

- [ ] **Step 3: Add a retired-product delete test**

Append to `DeleteProductTests.cs`:

```csharp
    [Fact]
    public async Task ProcessAsync_DeleteAlreadyRetiredProduct_NotFound()
    {
        var productId = Guid.NewGuid();
        var product = ProductBuilder.BuildEntity(publicId: productId);
        product.IsDeleted = true;

        var dbContext = AleTrackDbContextMockFactory.CreateMock(products: [product]);

        var endpoint = EndpointBuilder<DeleteProductRequest, DeleteProductEndpoint>.Create(dbContext.Object);

        var act = async () => await endpoint.HandleAsync(new DeleteProductRequest { Id = productId }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
```

- [ ] **Step 4: Add the filter to every selection site**

The edit is the same shape everywhere — add `!p.IsDeleted` to the existing predicate, or a `.Where(p => !p.IsDeleted)` where there is none. Examples:

`GetProductsListEndpoint.cs`:
```csharp
        var data = await dbContext.Products
            .Where(p => !p.IsDeleted)
            .OrderBy(c => c.Brewery.DisplayOrder)
```

`GetBreweryProductsListEndpoint.cs`:
```csharp
            .Where(p => p.Brewery.PublicId == req.Id && !p.IsDeleted)
```

`DeleteProductEndpoint.cs`:
```csharp
        var product = await dbContext.Products.FirstOrDefaultAsync(o => o.PublicId == req.Id && !o.IsDeleted, ct);
```

`UpdateProductEndpoint.cs`:
```csharp
        var product = await dbContext.Products.FirstOrDefaultAsync(p => p.PublicId == req.Id && !p.IsDeleted, ct);
```

For the multi-product resolution sites (`CreateOrderEndpoint:119`, `UpdateOrderEndpoint:200`, the three `ProductDeliveries` sites, `UpdateOutgoingShipmentEndpoint:528`), add `&& !p.IsDeleted` to the existing `Where(p => ids.Contains(p.PublicId))`. Their existing not-found handling then reports a retired product as not found, which is the wanted behaviour: a retired product cannot be added to a new order, delivery, inventory entry or stock purchase.

For `InventoryItems` Create/Update and `GetProductDetailEndpoint`/`GetProductsByClientHistoryEndpoint`, add the same clause to the existing predicate.

Add a short comment at the two skipped sites so the omission reads as deliberate:

```csharp
        // No !IsDeleted filter: this resolves a product the shipment already carries.
        // Retiring a product must not break loading a run that contains it.
        var product = await dbContext.Products.FirstOrDefaultAsync(p => p.PublicId == req.Data.ProductId, ct);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj`
Expected: the three new tests PASS, everything else still passes.

- [ ] **Step 6: Commit**

```bash
git add api/AleTrack/AleTrack/Features api/AleTrack/AleTrack.Tests/Features/Products
git commit -m "feat(products): hide retired products from pickers, keep them resolvable in history"
```

---

### Task 3: Brewery in-use guard

**Files:**
- Modify: `api/AleTrack/AleTrack/Features/Breweries/Commands/Delete/DeleteBreweryEndpoint.cs`
- Modify: `api/AleTrack/AleTrack/Common/Utils/ThrowHelper.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/Breweries/DeleteBreweryTests.cs`

**Interfaces:**
- Consumes: the `RESTRICT` behaviour from Task 1 (which is what turns this from data loss into a database error).
- Produces: `ThrowHelper.BreweryHasProducts(Guid breweryId, int productCount)`.

- [ ] **Step 1: Write the failing tests**

Add to the existing `DeleteBreweryTests.cs` (create it following `DeleteProductTests.cs` if absent):

```csharp
    [Fact]
    public async Task ProcessAsync_DeleteBreweryWithProducts_Fails()
    {
        var breweryId = Guid.NewGuid();
        var brewery = BreweryBuilder.BuildEntity(publicId: breweryId);
        var product = ProductBuilder.BuildEntity(publicId: Guid.NewGuid(), brewery: brewery);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            breweries: [brewery],
            products: [product]);

        var endpoint = EndpointBuilder<DeleteBreweryRequest, DeleteBreweryEndpoint>.Create(dbContext.Object);

        var act = async () => await endpoint.HandleAsync(new DeleteBreweryRequest { Id = breweryId }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>();
        dbContext.Verify(e => e.Breweries.Remove(It.IsAny<Brewery>()), Times.Never);
    }

    [Fact]
    public async Task ProcessAsync_DeleteBreweryWithoutProducts_Success()
    {
        var breweryId = Guid.NewGuid();
        var brewery = BreweryBuilder.BuildEntity(publicId: breweryId);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(breweries: [brewery]);

        var endpoint = EndpointBuilder<DeleteBreweryRequest, DeleteBreweryEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new DeleteBreweryRequest { Id = breweryId }, CancellationToken.None);

        dbContext.Verify(e => e.Breweries.Remove(It.IsAny<Brewery>()), Times.Once);
    }
```

- [ ] **Step 2: Run to verify the first fails**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~DeleteBreweryTests"`
Expected: `DeleteBreweryWithProducts_Fails` FAILS (no exception thrown, `Remove` called).

- [ ] **Step 3: Add the ThrowHelper method**

Follow the shape of the existing helpers in `ThrowHelper.cs` (they throw `AleTrackException` with an `ErrorCodes` value; match `ShipmentAlreadyDeliveredCannotBeDeleted` for the closest precedent):

```csharp
    /// <summary>
    /// Refuses to delete a brewery that still owns products.
    /// </summary>
    /// <remarks>
    /// order_items.product_id is Restrict, so letting this through would surface as a
    /// raw DbUpdateException. Refusing on any product at all — rather than only
    /// products with history — keeps the outcome predictable and avoids a partial
    /// cascade that removes the unused products and then fails on the used ones.
    /// </remarks>
    public static void BreweryHasProducts(Guid breweryId, int productCount)
    {
        throw new AleTrackException(
            ErrorCodes.BadRequestError,
            $"Brewery {breweryId} still has {productCount} product(s) and cannot be deleted. Retire them first.");
    }
```

Use whatever error-code constant the existing `BadRequest` helper uses so the HTTP mapping stays consistent.

- [ ] **Step 4: Guard the endpoint**

In `DeleteBreweryEndpoint.HandleAsync`, between the not-found check and `Remove`:

```csharp
        var productCount = await dbContext.Products.CountAsync(p => p.BreweryId == brewery!.Id, ct);
        if (productCount > 0)
            ThrowHelper.BreweryHasProducts(req.Id, productCount);
```

Add `Microsoft.EntityFrameworkCore` to the usings if absent, and document the 400 in the `Summary` block:

```csharp
                s.Responses[StatusCodes.Status400BadRequest] = "Brewery still has products";
```

- [ ] **Step 5: Run to verify pass**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add api/AleTrack/AleTrack/Features/Breweries api/AleTrack/AleTrack/Common/Utils/ThrowHelper.cs api/AleTrack/AleTrack.Tests/Features/Breweries
git commit -m "fix(breweries): refuse to delete a brewery that still owns products"
```

---

### Task 4: The mutability predicate and transition matrix

**Files:**
- Create: `api/AleTrack/AleTrack/Features/OutgoingShipments/Utils/ShipmentMutability.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentMutabilityTests.cs` (create)

**Interfaces:**
- Consumes: `OutgoingShipmentState` (`Created = 0, Loaded, InTransit, Delivered, Cancelled` — confirm the exact member order in `Common/Enums/OutgoingShipmentState.cs`).
- Produces:
  - `static bool ShipmentMutability.IsContentEditable(OutgoingShipmentState state)`
  - `static bool ShipmentMutability.IsTransitionAllowed(OutgoingShipmentState from, OutgoingShipmentState to)`

Both are consumed by Task 5 and Task 6. `IsContentEditable` is also referenced by Task 7's order guard through the shipment state.

- [ ] **Step 1: Write the failing tests**

```csharp
using AleTrack.Common.Enums;
using AleTrack.Features.OutgoingShipments.Utils;
using FluentAssertions;

namespace AleTrack.Tests.Features.OutgoingShipments;

public sealed class ShipmentMutabilityTests
{
    [Theory]
    [InlineData(OutgoingShipmentState.Created, true)]
    [InlineData(OutgoingShipmentState.Loaded, false)]
    [InlineData(OutgoingShipmentState.InTransit, false)]
    [InlineData(OutgoingShipmentState.Delivered, false)]
    [InlineData(OutgoingShipmentState.Cancelled, false)]
    public void IsContentEditable_OnlyInCreated(OutgoingShipmentState state, bool expected) =>
        ShipmentMutability.IsContentEditable(state).Should().Be(expected);

    [Theory]
    // Same state is always a no-op: every content save re-sends the current state.
    [InlineData(OutgoingShipmentState.Created, OutgoingShipmentState.Created, true)]
    [InlineData(OutgoingShipmentState.Delivered, OutgoingShipmentState.Delivered, true)]
    [InlineData(OutgoingShipmentState.Cancelled, OutgoingShipmentState.Cancelled, true)]
    // Single forward steps.
    [InlineData(OutgoingShipmentState.Created, OutgoingShipmentState.Loaded, true)]
    [InlineData(OutgoingShipmentState.Loaded, OutgoingShipmentState.InTransit, true)]
    [InlineData(OutgoingShipmentState.InTransit, OutgoingShipmentState.Delivered, true)]
    // Single backward steps between the active states.
    [InlineData(OutgoingShipmentState.Loaded, OutgoingShipmentState.Created, true)]
    [InlineData(OutgoingShipmentState.InTransit, OutgoingShipmentState.Loaded, true)]
    // Cancel from any active state.
    [InlineData(OutgoingShipmentState.Created, OutgoingShipmentState.Cancelled, true)]
    [InlineData(OutgoingShipmentState.Loaded, OutgoingShipmentState.Cancelled, true)]
    [InlineData(OutgoingShipmentState.InTransit, OutgoingShipmentState.Cancelled, true)]
    // Restore a cancelled run.
    [InlineData(OutgoingShipmentState.Cancelled, OutgoingShipmentState.Created, true)]
    // Delivered is terminal — this is the transition that unwound invoiced history.
    [InlineData(OutgoingShipmentState.Delivered, OutgoingShipmentState.InTransit, false)]
    [InlineData(OutgoingShipmentState.Delivered, OutgoingShipmentState.Loaded, false)]
    [InlineData(OutgoingShipmentState.Delivered, OutgoingShipmentState.Created, false)]
    [InlineData(OutgoingShipmentState.Delivered, OutgoingShipmentState.Cancelled, false)]
    // Skipping steps is not allowed.
    [InlineData(OutgoingShipmentState.Created, OutgoingShipmentState.InTransit, false)]
    [InlineData(OutgoingShipmentState.Created, OutgoingShipmentState.Delivered, false)]
    [InlineData(OutgoingShipmentState.Loaded, OutgoingShipmentState.Delivered, false)]
    [InlineData(OutgoingShipmentState.InTransit, OutgoingShipmentState.Created, false)]
    // A cancelled run restores to Created only.
    [InlineData(OutgoingShipmentState.Cancelled, OutgoingShipmentState.Loaded, false)]
    [InlineData(OutgoingShipmentState.Cancelled, OutgoingShipmentState.InTransit, false)]
    [InlineData(OutgoingShipmentState.Cancelled, OutgoingShipmentState.Delivered, false)]
    public void IsTransitionAllowed_MatchesTheMatrix(
        OutgoingShipmentState from, OutgoingShipmentState to, bool expected) =>
        ShipmentMutability.IsTransitionAllowed(from, to).Should().Be(expected);
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentMutabilityTests"`
Expected: compile error — `ShipmentMutability` does not exist.

- [ ] **Step 3: Implement**

```csharp
using AleTrack.Common.Enums;

namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// When a shipment's content may still change, and which state transitions are legal.
/// </summary>
/// <remarks>
/// Distinct from <c>PurchaseInvoiceSplit.IsEditable</c> and
/// <c>ShipmentInvoiceGraph.IsEditable</c>, which answer a different question — those
/// govern loading progress and invoice assignment, which stay adjustable until
/// delivery. This type governs <em>content</em>: what is on the truck, which freezes
/// when the truck is packed.
/// </remarks>
public static class ShipmentMutability
{
    /// <summary>
    /// Content — stops, orders, vehicle, via points, stock purchases — may only be
    /// changed while the shipment is still being planned.
    /// </summary>
    public static bool IsContentEditable(OutgoingShipmentState state) =>
        state == OutgoingShipmentState.Created;

    /// <summary>
    /// Legal target states from <paramref name="from"/>.
    /// </summary>
    /// <remarks>
    /// Single-step in both directions, mirroring the UI's own one-step forward and
    /// revert maps (ShipmentDetail.tsx). Staying in the same state is always allowed
    /// because every content save re-sends the current state. Delivered is terminal:
    /// reverting out of it re-ran the order transitions and freed already-delivered
    /// orders back to New, silently unwinding an invoiced, reported run. Cancelled
    /// restores to Created only, which is the shipped restore affordance.
    /// </remarks>
    public static bool IsTransitionAllowed(OutgoingShipmentState from, OutgoingShipmentState to)
    {
        if (from == to)
            return true;

        return from switch
        {
            OutgoingShipmentState.Created => to is OutgoingShipmentState.Loaded
                or OutgoingShipmentState.Cancelled,
            OutgoingShipmentState.Loaded => to is OutgoingShipmentState.Created
                or OutgoingShipmentState.InTransit
                or OutgoingShipmentState.Cancelled,
            OutgoingShipmentState.InTransit => to is OutgoingShipmentState.Loaded
                or OutgoingShipmentState.Delivered
                or OutgoingShipmentState.Cancelled,
            OutgoingShipmentState.Delivered => false,
            OutgoingShipmentState.Cancelled => to is OutgoingShipmentState.Created,
            _ => false
        };
    }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentMutabilityTests"`
Expected: all theory cases PASS.

- [ ] **Step 5: Commit**

```bash
git add api/AleTrack/AleTrack/Features/OutgoingShipments/Utils/ShipmentMutability.cs \
        api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentMutabilityTests.cs
git commit -m "feat(shipments): add the content-editability predicate and transition matrix"
```

---

### Task 5: The content diff

**Files:**
- Create: `api/AleTrack/AleTrack/Features/OutgoingShipments/Utils/ShipmentContentGuard.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentContentGuardTests.cs` (create)

**Interfaces:**
- Consumes: `OutgoingShipment` (entity), `UpdateOutgoingShipmentDto`.
- Produces: `static List<string> ShipmentContentGuard.ChangedFrozenFields(OutgoingShipment stored, UpdateOutgoingShipmentDto incoming)` — returns the DTO property names whose frozen value differs. Empty means the request changes no frozen content. Consumed by Task 6.

- [ ] **Step 1: Write the failing tests**

Cover one case per frozen field plus the critical negative. Use `OutgoingShipmentBuilder` and `OutgoingShipmentBuilder.BuildUpdateDto` as `UpdateOutgoingShipmentTests` already does.

```csharp
using AleTrack.Common.Enums;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Tests.Builders;
using FluentAssertions;

namespace AleTrack.Tests.Features.OutgoingShipments;

public sealed class ShipmentContentGuardTests
{
    [Fact]
    public void ChangedFrozenFields_UnchangedRequest_ReturnsEmpty()
    {
        // The exact shape ShipmentDetail.advance() sends: the whole object round-tripped
        // with only State swapped. This must never be reported as a content change.
        var (shipment, dto) = RoundTripped();

        dto.State = OutgoingShipmentState.InTransit;

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto).Should().BeEmpty();
    }

    [Fact]
    public void ChangedFrozenFields_MutableFieldsChanged_ReturnsEmpty()
    {
        var (shipment, dto) = RoundTripped();

        dto.Name = "Renamed run";
        dto.DeliveryDate = DateTime.UtcNow.AddDays(9);
        dto.DriverIds = [Guid.NewGuid()];

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto).Should().BeEmpty();
    }

    [Fact]
    public void ChangedFrozenFields_VehicleChanged_ReportsVehicleId()
    {
        var (shipment, dto) = RoundTripped();

        dto.VehicleId = Guid.NewGuid();

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto).Should().Contain("VehicleId");
    }

    [Fact]
    public void ChangedFrozenFields_OrderRemoved_ReportsClientOrderShipments()
    {
        var (shipment, dto) = RoundTripped();

        dto.ClientOrderShipments.RemoveAt(0);

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto).Should().Contain("ClientOrderShipments");
    }

    [Fact]
    public void ChangedFrozenFields_StopResequenced_ReportsClientOrderShipments()
    {
        var (shipment, dto) = RoundTripped();

        dto.ClientOrderShipments[0].Order += 10;

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto).Should().Contain("ClientOrderShipments");
    }

    [Fact]
    public void ChangedFrozenFields_LoadingProgressChanged_ReturnsEmpty()
    {
        // Loading progress travels inside ClientOrderShipments but is not content —
        // the nakladka writes it while the shipment is Loaded and InTransit.
        var (shipment, dto) = RoundTripped();

        dto.ClientOrderShipments[0].OrderItems[0].IsLoadingConfirmed = true;
        dto.ClientOrderShipments[0].OrderItems[0].QuantityFromInventory = 3;

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto).Should().BeEmpty();
    }

    [Fact]
    public void ChangedFrozenFields_CustomStopMoved_ReportsCustomStops()
    {
        var (shipment, dto) = RoundTripped();

        dto.CustomStops[0].Latitude += 1m;

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto).Should().Contain("CustomStops");
    }

    [Fact]
    public void ChangedFrozenFields_ViaPointAdded_ReportsRouteViaPoints()
    {
        var (shipment, dto) = RoundTripped();

        dto.RouteViaPoints.Add(new RoutePointDto { Latitude = 50.1m, Longitude = 14.4m });

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto).Should().Contain("RouteViaPoints");
    }

    [Fact]
    public void ChangedFrozenFields_StockPurchaseQuantityChanged_ReportsStockPurchases()
    {
        var (shipment, dto) = RoundTripped();

        dto.StockPurchases[0].Quantity += 5;

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto).Should().Contain("StockPurchases");
    }

    [Fact]
    public void ChangedFrozenFields_StockPurchaseLoadingConfirmedChanged_ReturnsEmpty()
    {
        var (shipment, dto) = RoundTripped();

        dto.StockPurchases[0].IsLoadingConfirmed = !dto.StockPurchases[0].IsLoadingConfirmed;

        ShipmentContentGuard.ChangedFrozenFields(shipment, dto).Should().BeEmpty();
    }
}
```

Add a private `RoundTripped()` helper to that test class building a `Loaded` shipment that carries: two order stops (one with an order item), one custom stop, one via point and one stock purchase — and a DTO describing exactly that same content. Build it from the existing builders; if `OutgoingShipmentBuilder` cannot express custom stops or stock purchases, construct the entity graph inline in the helper rather than extending the builder.

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentContentGuardTests"`
Expected: compile error — `ShipmentContentGuard` does not exist.

- [ ] **Step 3: Implement the diff**

```csharp
using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Commands.Update;

namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// Compares an update request against the stored shipment and reports which frozen
/// fields it would actually change.
/// </summary>
/// <remarks>
/// Comparing rather than blanket-rejecting is what lets the existing full-object PUT
/// keep working: ShipmentDetail.advance() re-sends the whole shipment with only State
/// swapped, so every frozen field matches and the request passes.
///
/// Must be called before the endpoint touches the entity — GetOrderStopsAsync mutates
/// existing stops in place, which would make the stored side of this comparison
/// reflect the request rather than the database.
/// </remarks>
public static class ShipmentContentGuard
{
    public static List<string> ChangedFrozenFields(OutgoingShipment stored, UpdateOutgoingShipmentDto incoming)
    {
        var changed = new List<string>();

        if (stored.Vehicle?.PublicId != incoming.VehicleId)
            changed.Add(nameof(incoming.VehicleId));

        if (!OrderStopsMatch(stored, incoming))
            changed.Add(nameof(incoming.ClientOrderShipments));

        if (!CustomStopsMatch(stored, incoming))
            changed.Add(nameof(incoming.CustomStops));

        if (!ViaPointsMatch(stored, incoming))
            changed.Add(nameof(incoming.RouteViaPoints));

        if (!StockPurchasesMatch(stored, incoming))
            changed.Add(nameof(incoming.StockPurchases));

        return changed;
    }

    // Composition only. Loading confirmation and inventory sourcing ride along in the
    // same DTO field but are progress, not content, and stay writable.
    private static bool OrderStopsMatch(OutgoingShipment stored, UpdateOutgoingShipmentDto incoming)
    {
        var storedStops = stored.Stops
            .Where(s => s.Kind == OutgoingShipmentStopKind.Order && s.ClientOrder is not null)
            .Select(s => (
                s.ClientOrder!.PublicId,
                s.Order,
                s.SelectedAddressKind,
                PlaceId: s.ClientDeliveryPlace?.PublicId))
            .OrderBy(s => s.PublicId)
            .ToList();

        var incomingStops = incoming.ClientOrderShipments
            .Select(s => (
                PublicId: s.ClientOrderId,
                s.Order,
                s.SelectedAddressKind,
                PlaceId: s.ClientDeliveryPlaceId))
            .OrderBy(s => s.PublicId)
            .ToList();

        return storedStops.SequenceEqual(incomingStops);
    }

    private static bool CustomStopsMatch(OutgoingShipment stored, UpdateOutgoingShipmentDto incoming)
    {
        var storedStops = stored.Stops
            .Where(s => s.Kind == OutgoingShipmentStopKind.Custom)
            .Select(s => (Id: (Guid?)s.PublicId, s.Order, s.Label, s.Note, s.Latitude, s.Longitude))
            .OrderBy(s => s.Id)
            .ToList();

        var incomingStops = incoming.CustomStops
            .Select(s => (s.Id, s.Order, Label: (string?)s.Label, s.Note,
                Latitude: (decimal?)s.Latitude, Longitude: (decimal?)s.Longitude))
            .OrderBy(s => s.Id)
            .ToList();

        return storedStops.SequenceEqual(incomingStops);
    }

    // Ordered: via points shape the drawn route, so their sequence is content.
    private static bool ViaPointsMatch(OutgoingShipment stored, UpdateOutgoingShipmentDto incoming)
    {
        var storedPoints = stored.RouteViaPoints
            .OrderBy(p => p.Order)
            .Select(p => (p.Latitude, p.Longitude))
            .ToList();

        var incomingPoints = incoming.RouteViaPoints
            .Select(p => (p.Latitude, p.Longitude))
            .ToList();

        return storedPoints.SequenceEqual(incomingPoints);
    }

    private static bool StockPurchasesMatch(OutgoingShipment stored, UpdateOutgoingShipmentDto incoming)
    {
        var storedPurchases = stored.StockPurchases
            .Select(p => (p.Product.PublicId, p.Quantity))
            .OrderBy(p => p.PublicId)
            .ThenBy(p => p.Quantity)
            .ToList();

        var incomingPurchases = incoming.StockPurchases
            .Select(p => (PublicId: p.ProductId, p.Quantity))
            .OrderBy(p => p.PublicId)
            .ThenBy(p => p.Quantity)
            .ToList();

        return storedPurchases.SequenceEqual(incomingPurchases);
    }
}
```

Check the actual types on `RoutePointDto` (`decimal` vs `decimal?`) and `OutgoingShipmentRoutePoint`, and on `CustomStopDto.Latitude` (`decimal`) versus `OutgoingShipmentStop.Latitude` (`decimal?`), and adjust the casts so the tuples are comparable. The compiler will catch mismatches.

- [ ] **Step 4: Run to verify pass**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentContentGuardTests"`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add api/AleTrack/AleTrack/Features/OutgoingShipments/Utils/ShipmentContentGuard.cs \
        api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentContentGuardTests.cs
git commit -m "feat(shipments): diff an update against the stored content"
```

---

### Task 6: Wire both guards into the shipment update endpoint

**Files:**
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Commands/Update/UpdateOutgoingShipmentEndpoint.cs:64-100`
- Modify: `api/AleTrack/AleTrack/Common/Utils/ThrowHelper.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/UpdateOutgoingShipmentTests.cs`

**Interfaces:**
- Consumes: `ShipmentMutability.IsContentEditable`, `ShipmentMutability.IsTransitionAllowed` (Task 4); `ShipmentContentGuard.ChangedFrozenFields` (Task 5).
- Produces: `ThrowHelper.ShipmentTransitionNotAllowed(OutgoingShipmentState from, OutgoingShipmentState to)` and `ThrowHelper.ShipmentContentFrozen(OutgoingShipmentState state, IReadOnlyCollection<string> fields)`.

- [ ] **Step 1: Write the failing endpoint tests**

Add to `UpdateOutgoingShipmentTests.cs`:

```csharp
    [Fact]
    public async Task ProcessAsync_ChangeContentOfLoadedShipment_Fails()
    {
        // Build a Loaded shipment carrying one order, then send a request that drops it.
        // Assert AleTrackException and that SaveChangesAsync never ran.
    }

    [Fact]
    public async Task ProcessAsync_AdvanceLoadedShipmentWithUnchangedContent_Success()
    {
        // The advance() path: same content, State moved Loaded -> InTransit. Must succeed.
    }

    [Fact]
    public async Task ProcessAsync_RevertDeliveredShipment_Fails()
    {
        // Delivered -> InTransit. Assert AleTrackException, SaveChangesAsync never ran,
        // and the orders were NOT freed back to New.
    }

    [Fact]
    public async Task ProcessAsync_SkipStates_Fails()
    {
        // Created -> Delivered. Assert AleTrackException.
    }

    [Fact]
    public async Task ProcessAsync_ChangeDriversOfLoadedShipment_Success()
    {
        // Drivers, name and delivery date stay mutable from Loaded onward.
    }

    [Fact]
    public async Task ProcessAsync_ConfirmLoadingOnLoadedShipment_Success()
    {
        // IsLoadingConfirmed / QuantityFromInventory still writable while Loaded.
    }
```

Fill each body following the existing `ProcessAsync_UpdateOutgoingShipment_Success` pattern in the same file. Assert absence of a save with
`dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never)`.

- [ ] **Step 2: Run to verify they fail**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~UpdateOutgoingShipmentTests"`
Expected: the four rejection tests FAIL (no exception raised); the two permissive tests may already pass.

- [ ] **Step 3: Add the ThrowHelper methods**

```csharp
    /// <summary>
    /// Refuses an illegal shipment state transition.
    /// </summary>
    public static void ShipmentTransitionNotAllowed(OutgoingShipmentState from, OutgoingShipmentState to)
    {
        throw new AleTrackException(
            ErrorCodes.BadRequestError,
            $"A {from} shipment cannot move to {to}.");
    }

    /// <summary>
    /// Refuses a change to content that froze when the shipment left Created.
    /// </summary>
    public static void ShipmentContentFrozen(OutgoingShipmentState state, IReadOnlyCollection<string> fields)
    {
        throw new AleTrackException(
            ErrorCodes.BadRequestError,
            $"The content of a {state} shipment is frozen; these fields cannot change: {string.Join(", ", fields)}.");
    }
```

Match the error-code constant used by the existing `BadRequest` helper.

- [ ] **Step 4: Add the Include the diff needs, then the guard**

The endpoint's current load does not include `ClientDeliveryPlace`, which `ShipmentContentGuard.OrderStopsMatch` reads. Add it to the existing stops Include chain:

```csharp
        .Include(os => os.Stops)
            .ThenInclude(s => s.ClientDeliveryPlace)
```

Then, immediately after the `if (outgoingShipment is null) ThrowHelper...` check and **before** the `previousStopOrders` snapshot — nothing above this point may have mutated the entity:

```csharp
        // Both guards run before anything touches the entity: GetOrderStopsAsync below
        // mutates existing stops in place, which would make the stored side of the
        // content diff reflect the request instead of the database.
        if (!ShipmentMutability.IsTransitionAllowed(outgoingShipment!.State, req.Data.State))
            ThrowHelper.ShipmentTransitionNotAllowed(outgoingShipment.State, req.Data.State);

        if (!ShipmentMutability.IsContentEditable(outgoingShipment.State))
        {
            var frozenChanges = ShipmentContentGuard.ChangedFrozenFields(outgoingShipment, req.Data);
            if (frozenChanges.Count > 0)
                ThrowHelper.ShipmentContentFrozen(outgoingShipment.State, frozenChanges);
        }
```

The existing `outgoingShipment!` null-forgiving operator on the next line becomes redundant; leave the surrounding code otherwise untouched.

Document the new response in the `Summary` block:

```csharp
                s.Responses[StatusCodes.Status400BadRequest] = "Illegal state transition, or frozen content changed";
```

- [ ] **Step 5: Run the full suite**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj`
Expected: all pass. Pre-existing fixtures that jump states (for example straight to `Delivered` from `Created`) will fail here — fix the fixture to step through the intermediate states. Do **not** loosen the matrix to accommodate a fixture.

- [ ] **Step 6: Commit**

```bash
git add api/AleTrack/AleTrack/Features/OutgoingShipments api/AleTrack/AleTrack/Common/Utils/ThrowHelper.cs api/AleTrack/AleTrack.Tests/Features/OutgoingShipments
git commit -m "fix(shipments): freeze content and reject illegal transitions on update"
```

---

### Task 7: Order content guard

**Files:**
- Modify: `api/AleTrack/AleTrack/Features/Orders/Commands/Update/UpdateOrderEndpoint.cs:62-119`
- Create: `api/AleTrack/AleTrack/Features/Orders/Utils/OrderMutability.cs`
- Modify: `api/AleTrack/AleTrack/Common/Utils/ThrowHelper.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/Orders/UpdateOrderTests.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/Orders/OrderMutabilityTests.cs` (create)

**Interfaces:**
- Consumes: `Order` entity, `OrderState`, `OutgoingShipmentState`.
- Produces: `static bool OrderMutability.IsContentEditable(Order order)`; `ThrowHelper.OrderContentFrozen(Guid orderId)`.

- [ ] **Step 1: Write the failing predicate tests**

```csharp
using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Orders.Utils;
using FluentAssertions;

namespace AleTrack.Tests.Features.Orders;

public sealed class OrderMutabilityTests
{
    [Theory]
    [InlineData(OrderState.New, true)]
    [InlineData(OrderState.Planning, true)]
    [InlineData(OrderState.Delivering, true)]
    [InlineData(OrderState.Finished, false)]
    [InlineData(OrderState.Cancelled, false)]
    public void IsContentEditable_FollowsOrderState_WhenNotOnAShipment(OrderState state, bool expected)
    {
        var order = new Order { State = state };

        OrderMutability.IsContentEditable(order).Should().Be(expected);
    }

    [Theory]
    [InlineData(OutgoingShipmentState.Created, true)]
    [InlineData(OutgoingShipmentState.Loaded, false)]
    [InlineData(OutgoingShipmentState.InTransit, false)]
    [InlineData(OutgoingShipmentState.Delivered, false)]
    // A cancelled run frees its orders for reuse but the stop link survives, so a
    // freed order must stay editable.
    [InlineData(OutgoingShipmentState.Cancelled, true)]
    public void IsContentEditable_FollowsShipmentState(OutgoingShipmentState shipmentState, bool expected)
    {
        var order = new Order
        {
            State = OrderState.Planning,
            OutgoingShipmentStop = new OutgoingShipmentStop
            {
                OutgoingShipment = new OutgoingShipment { State = shipmentState }
            }
        };

        OrderMutability.IsContentEditable(order).Should().Be(expected);
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~OrderMutabilityTests"`
Expected: compile error — `OrderMutability` does not exist.

- [ ] **Step 3: Implement the predicate**

```csharp
using AleTrack.Common.Enums;
using AleTrack.Entities;

namespace AleTrack.Features.Orders.Utils;

/// <summary>
/// When an order's content — its items, client, address and delivery outcome — may
/// still change.
/// </summary>
public static class OrderMutability
{
    /// <summary>
    /// Frozen once the order itself is closed, or once the shipment carrying it has
    /// been packed.
    /// </summary>
    /// <remarks>
    /// Mirrors <see cref="OutgoingShipments.Utils.ShipmentMutability.IsContentEditable"/>,
    /// because order items <em>are</em> the shipment's content — guarding only the
    /// order's own terminal states would leave a back door through the order screen
    /// into a packed shipment.
    ///
    /// Cancelled shipments are deliberately excluded: cancelling frees its orders back
    /// to New for reuse, but the stop link survives, so treating Cancelled as frozen
    /// would strand every freed order.
    /// </remarks>
    public static bool IsContentEditable(Order order)
    {
        if (order.State is OrderState.Finished or OrderState.Cancelled)
            return false;

        var shipmentState = order.OutgoingShipmentStop?.OutgoingShipment?.State;

        return shipmentState is not (OutgoingShipmentState.Loaded
            or OutgoingShipmentState.InTransit
            or OutgoingShipmentState.Delivered);
    }
}
```

- [ ] **Step 4: Write the failing endpoint tests**

Add to `UpdateOrderTests.cs`:

```csharp
    [Fact]
    public async Task ProcessAsync_UpdateItemsOfFinishedOrder_Fails()
    {
        // Finished order, request changes a quantity. Assert AleTrackException and that
        // SaveChangesAsync never ran.
    }

    [Fact]
    public async Task ProcessAsync_UpdateItemsOfOrderOnLoadedShipment_Fails()
    {
        // Order on a Loaded shipment. Same assertions.
    }

    [Fact]
    public async Task ProcessAsync_UpdateNotesOfFinishedOrder_Success()
    {
        // Notes, returns and RequiredDeliveryDate stay editable on a frozen order, and
        // the OrderItems collection must be left untouched — assert the same OrderItem
        // instances are still present afterwards, since recreating them cascades the
        // invoice lines away.
    }

    [Fact]
    public async Task ProcessAsync_UpdateItemsOfOrderFreedFromCancelledShipment_Success()
    {
        // Order back in New, still linked to a Cancelled shipment's stop. Must succeed.
    }
```

- [ ] **Step 5: Run to verify they fail**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~UpdateOrderTests"`
Expected: the two rejection tests FAIL.

- [ ] **Step 6: Guard the endpoint**

Extend the load at `UpdateOrderEndpoint.cs:62-69` so the predicate can see the shipment:

```csharp
            .Include(o => o.OutgoingShipmentStop)
                .ThenInclude(s => s!.OutgoingShipment)
```

Add the `ThrowHelper` method:

```csharp
    /// <summary>
    /// Refuses a change to the content of a closed order, or of one already loaded onto
    /// a shipment.
    /// </summary>
    public static void OrderContentFrozen(Guid orderId)
    {
        throw new AleTrackException(
            ErrorCodes.BadRequestError,
            $"Order {orderId} has been closed or loaded; its items, client, address and delivery outcome can no longer change.");
    }
```

Then, after the not-found check, compute editability once and branch. The frozen path must reject a real change and otherwise **skip the rebuild entirely**:

```csharp
        var contentEditable = OrderMutability.IsContentEditable(order!);

        if (!contentEditable && RequestChangesFrozenContent(order!, req.Data))
            ThrowHelper.OrderContentFrozen(req.Id);
```

Guard each frozen assignment. `ClientId`, the address writer, `ActualDeliveryDate`, `State` and the whole `OrderItems` rebuild run only when `contentEditable`:

```csharp
        if (contentEditable)
        {
            // ... existing clientChanged block, State, ActualDeliveryDate,
            // OrderDeliveryAddressWriter.ApplyAsync/PropagateToStopAsync, and the
            // OrderItems.Clear() + re-add loop, unchanged.
        }

        order.RequiredDeliveryDate = req.Data.RequiredDeliveryDate;
        order.Returns = GetReturns(req.Data.Returns, order);
        order.Notes = GetNotes(req.Data.Notes, order);
        order.CustomExtraItems = GetCustomExtras(req.Data.CustomExtraItems, order);
```

Note that `GetExistingProductsAsync` must also move inside the editable branch — it is only needed by the rebuild, and on a frozen order its retired-product filter from Task 2 would otherwise reject a legitimate notes-only save of an order containing a since-retired product.

Add the private comparison helper in the same file:

```csharp
    /// <summary>
    /// Whether the request would actually change frozen content. Comparing rather than
    /// blanket-rejecting keeps the full-object PUT working for notes-only saves.
    /// </summary>
    private static bool RequestChangesFrozenContent(Order order, UpdateOrderDto data)
    {
        if (data.ClientId != order.Client.PublicId
            || data.State != order.State
            || data.ActualDeliveryDate != order.ActualDeliveryDate
            || data.DeliveryAddressKind != order.DeliveryAddressKind
            || data.ClientDeliveryPlaceId != order.ClientDeliveryPlace?.PublicId)
            return true;

        var storedItems = order.OrderItems
            .Select(i => (i.Product.PublicId, i.Quantity, i.ReminderState))
            .OrderBy(i => i.PublicId)
            .ThenBy(i => i.Quantity)
            .ToList();

        var incomingItems = data.OrderItems
            .Select(i => (PublicId: i.ProductId, i.Quantity, i.ReminderState))
            .OrderBy(i => i.PublicId)
            .ThenBy(i => i.Quantity)
            .ToList();

        return !storedItems.SequenceEqual(incomingItems);
    }
```

This needs `Product` and `ClientDeliveryPlace` on the loaded graph — add `.ThenInclude(oi => oi.Product)` to the existing `Include(o => o.OrderItems)` and `.Include(o => o.ClientDeliveryPlace)`.

- [ ] **Step 7: Run the full suite**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add api/AleTrack/AleTrack/Features/Orders api/AleTrack/AleTrack/Common/Utils/ThrowHelper.cs api/AleTrack/AleTrack.Tests/Features/Orders
git commit -m "fix(orders): freeze the content of closed and loaded orders"
```

---

### Task 8: Drop the Delivered revert affordance

**Files:**
- Modify: `app/src/features/shipments/ShipmentDetail.tsx:748-752`
- Test: `app/src/features/shipments/ShipmentDetail.test.tsx`

**Interfaces:**
- Consumes: the transition matrix from Task 4 (the UI must not offer what the API now rejects).
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

Add to `ShipmentDetail.test.tsx`, following the mocking already set up in that file:

```tsx
  it('offers no revert on a delivered shipment', () => {
    // Render the detail for a Delivered shipment and assert the revert control is absent.
    // Delivered is terminal server-side; offering it would only produce a 400.
  });
```

Read the file's existing render helper and state-fixture pattern first, and use whatever accessible name the revert button actually renders with.

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && yarn test:run ShipmentDetail`
Expected: FAIL — the revert control is present.

- [ ] **Step 3: Remove the entry**

```tsx
  // Delivered is terminal: reverting out of it re-ran the order transitions and freed
  // already-delivered orders back to New, unwinding an invoiced, reported run. The API
  // rejects it, so the affordance is gone.
  const revertTo = ({
    Loaded: S.Created,
    InTransit: S.Loaded,
  } as Record<string, OutgoingShipmentState>)[stateName ?? ''];
```

- [ ] **Step 4: Run the frontend checks**

```bash
cd app && yarn test:run && yarn build
```
Expected: tests pass, `yarn build` typechecks and bundles clean. Confirm `git status` shows **no** change to `src/generated/api-client.ts`.

- [ ] **Step 5: Commit**

```bash
git add app/src/features/shipments/ShipmentDetail.tsx app/src/features/shipments/ShipmentDetail.test.tsx
git commit -m "fix(shipments): stop offering a revert out of Delivered"
```

---

## Final verification

- [ ] `cd api/AleTrack && dotnet build AleTrack.sln` — 0 errors
- [ ] `dotnet test AleTrack.Tests/AleTrack.Tests.csproj` — full suite green, note the count against the 384 passing before this work
- [ ] `cd app && yarn test:run && yarn build` — green
- [ ] `git status` — no changes to `src/generated/api-client.ts`, and `appsettings.*.json` / `Program.cs` / `launchSettings.json` / `d.txt` / `r.txt` / `r2.txt` still unstaged and untouched
- [ ] `git log --oneline` on `feat/25-history-integrity-guards` shows the design commit plus eight task commits
