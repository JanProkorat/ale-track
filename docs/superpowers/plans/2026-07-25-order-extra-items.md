# Order Extra Items Implementation Plan

> **SUPERSEDED — do not execute.** This plan moved *both* extra kinds onto the
> order. That was wrong for inventory-sourced items: an order records what the
> client wants, not where the pieces come from. The shipped design keeps sourcing
> on the shipment as `OrderItem.quantity_from_inventory`, and moves only custom
> extras to the order. See the *Correction* section at the top of
> [`../specs/2026-07-25-order-extra-items-design.md`](../specs/2026-07-25-order-extra-items-design.md).
> Kept for the record — Tasks 2, 3 and 6–8 still describe the custom-extra half
> accurately.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move client extras (dokládka from inventory) and custom extras off `OutgoingShipment` and onto `Order`, so the billed client is structural rather than a nullable column.

**Architecture:** Two new order-owned entities replace the two shipment-owned ones, following the `OrderReturn` / `OrderNote` precedent already in this codebase: nested collections on `Order`, diffed by `PublicId` on update, projected read-only onto `OutgoingShipmentStopDto`. The shipment keeps two responsibilities it must not lose — flipping each row's loading-confirmation flag, and subtracting stock on the transition to Loaded — both of which now reach the rows through `Stop.ClientOrder`. `OutgoingShipmentInventoryExtraItem` is untouched throughout.

**Tech Stack:** .NET 10, FastEndpoints, EF Core + Npgsql, xUnit + FluentAssertions + Moq.EntityFrameworkCore; React 19, MUI 7, TanStack Query, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-25-order-extra-items-design.md`

## Global Constraints

- Branch is `feat/order-extra-items`, already created off `dev`.
- UI strings are **Czech**; code, comments and commit messages are **English**.
- Backend commands run from `api/AleTrack/`; frontend from `app/`.
- Backend tests: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj` — currently **149 passing**, must never regress.
- Frontend: `yarn vitest run` (**92 passing**), `yarn tsc --noEmit`, `yarn lint` (0 errors; 4 pre-existing warnings in `AuthProvider`, `UnsavedChangesGuard`, `CurrencyProvider`, `ThemeProvider` are expected).
- `app/src/generated/api-client.ts` is **generated** — never hand-edit. Regenerate with the backend running, in the **same commit** as the backend change.
- Never edit `appsettings.*.json`, `.env*`, `launchSettings.json`. These have uncommitted local changes that must stay uncommitted.
- Migrations are **not** auto-applied in deployed environments; apply locally with
  `dotnet ef database update --connection "Host=localhost;Port=5432;Database=AleTrack;Username=postgres;Password=postgres"` from `api/AleTrack/AleTrack/`.
- Do **not** touch `OutgoingShipmentInventoryExtraItem` or `OutgoingShipment.InventoryExtraItems`.

## File Structure

**Backend — create**
- `AleTrack/Entities/OrderClientExtraItem.cs` — inventory-sourced extra owned by an order
- `AleTrack/Entities/OrderCustomExtraItem.cs` — free-form extra owned by an order
- `AleTrack/Features/Orders/Utils/OrderClientExtraItemDto.cs` — read/write DTO + validator
- `AleTrack/Features/Orders/Utils/OrderCustomExtraItemDto.cs` — read/write DTO + validator
- `AleTrack/Features/OutgoingShipments/Utils/ExtraItemInfoDto.cs` — confirm-only `{Id, IsLoadingConfirmed}`
- `AleTrack.Tests/Features/Orders/OrderExtraItemsTests.cs`
- `AleTrack.Tests/Features/OutgoingShipments/ShipmentExtraItemConfirmationTests.cs`

**Backend — delete**
- `AleTrack/Entities/OutgoingShipmentClientExtraItem.cs`
- `AleTrack/Entities/OutgoingShipmentCustomExtraItem.cs`
- `AleTrack/Features/OutgoingShipments/Utils/ExtraShipmentDtoValidator.cs` (client/custom parts only — keep the inventory-extra validator)

**Backend — modify**
- `AleTrack/Entities/Order.cs`, `AleTrack/Entities/OutgoingShipment.cs`
- `AleTrack/Features/Orders/Commands/{Create,Update}/*`, `Queries/Detail/*`
- `AleTrack/Features/OutgoingShipments/Commands/{Create,Update}/*`, `Queries/Detail/*`
- `AleTrack/Features/OutgoingShipments/Utils/{ClientOrderShipmentDto,ShipmentInvoiceGraph,ShipmentInvoiceReconciler}.cs`
- `AleTrack.Tests/Builders/OrderBuilder.cs`

**Frontend — modify**
- `app/src/generated/api-client.ts` (regenerated)
- `app/src/features/orders/{OrderEditor,OrderDetail}.tsx` + their tests
- `app/src/features/shipments/{ShipmentDetail,shipmentDraft}.ts[x]`

---

### Task 1: Entities and migration

**Files:**
- Create: `api/AleTrack/AleTrack/Entities/OrderClientExtraItem.cs`, `api/AleTrack/AleTrack/Entities/OrderCustomExtraItem.cs`
- Modify: `api/AleTrack/AleTrack/Entities/Order.cs`, `api/AleTrack/AleTrack/Entities/OutgoingShipment.cs`
- Delete: `api/AleTrack/AleTrack/Entities/OutgoingShipmentClientExtraItem.cs`, `api/AleTrack/AleTrack/Entities/OutgoingShipmentCustomExtraItem.cs`

**Interfaces:**
- Produces: `OrderClientExtraItem { long OrderId; long InventoryItemId; int Quantity; bool IsShipmentLoadingConfirmed; Order Order; InventoryItem InventoryItem }`, `OrderCustomExtraItem { long OrderId; string Description; int Quantity; bool IsShipmentLoadingConfirmed; Order Order }`, `Order.ClientExtraItems`, `Order.CustomExtraItems`.
- Note: the build will be **red** until Task 5 — every consumer of the deleted types is fixed in Tasks 2–5. Do not try to make it green here.

- [ ] **Step 1: Create `OrderClientExtraItem.cs`**

```csharp
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// A dokládka: stock pulled from the inventory and delivered to the client on top
/// of their order. Owned by the order, so the billed client is structural.
/// </summary>
[Table("order_client_extra_items")]
public sealed class OrderClientExtraItem : PublicEntity
{
    /// <summary>ID of related <see cref="Entities.Order"/></summary>
    [Column("order_id")]
    public long OrderId { get; set; }

    /// <summary>ID of the inventory item this extra was taken from</summary>
    [Column("inventory_item_id")]
    public long InventoryItemId { get; set; }

    /// <summary>Quantity delivered to the client</summary>
    [Column("quantity")]
    public int Quantity { get; set; }

    /// <summary>Whether loading was confirmed on the shipment carrying this order.</summary>
    [Column("is_shipment_loading_confirmed")]
    public bool IsShipmentLoadingConfirmed { get; set; }

    /// <summary>The parent order.</summary>
    public Order Order { get; set; } = null!;

    /// <summary>Inventory item this extra was taken from.</summary>
    [DeleteBehavior(DeleteBehavior.NoAction)]
    public InventoryItem InventoryItem { get; set; } = null!;
}
```

- [ ] **Step 2: Create `OrderCustomExtraItem.cs`**

```csharp
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;

namespace AleTrack.Entities;

/// <summary>
/// A free-form billable item delivered to the client on top of their order.
/// </summary>
[Table("order_custom_extra_items")]
public sealed class OrderCustomExtraItem : PublicEntity
{
    /// <summary>ID of related <see cref="Entities.Order"/></summary>
    [Column("order_id")]
    public long OrderId { get; set; }

    /// <summary>Description of the extra item</summary>
    [MaxLength(200)]
    [Column("description")]
    public string Description { get; set; } = null!;

    /// <summary>Quantity delivered to the client</summary>
    [Column("quantity")]
    public int Quantity { get; set; }

    /// <summary>Whether loading was confirmed on the shipment carrying this order.</summary>
    [Column("is_shipment_loading_confirmed")]
    public bool IsShipmentLoadingConfirmed { get; set; }

    /// <summary>The parent order.</summary>
    public Order Order { get; set; } = null!;
}
```

- [ ] **Step 3: Add both collections to `Order.cs`**

Immediately after the existing `Returns` collection:

```csharp
    /// <summary>
    /// Stock pulled from the inventory and delivered on top of this order (dokládka)
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public ICollection<OrderClientExtraItem> ClientExtraItems { get; set; } = [];

    /// <summary>
    /// Free-form billable items delivered on top of this order
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public ICollection<OrderCustomExtraItem> CustomExtraItems { get; set; } = [];
```

- [ ] **Step 4: Remove both collections from `OutgoingShipment.cs`**

Delete the `ClientExtraItems` and `CustomExtraItems` properties with their doc comments. **Leave `InventoryExtraItems` exactly as it is.**

- [ ] **Step 5: Delete the two shipment entity files**

```bash
rm api/AleTrack/AleTrack/Entities/OutgoingShipmentClientExtraItem.cs \
   api/AleTrack/AleTrack/Entities/OutgoingShipmentCustomExtraItem.cs
```

- [ ] **Step 6: Commit (build is intentionally red)**

```bash
git add api/AleTrack/AleTrack/Entities/
git commit -m "refactor(orders): order-owned extra item entities"
```

The migration is deliberately deferred to Task 5, where the build is green again — `dotnet ef` has to compile the project to scaffold.

---

### Task 2: Order write path

**Files:**
- Create: `api/AleTrack/AleTrack/Features/Orders/Utils/OrderClientExtraItemDto.cs`, `api/AleTrack/AleTrack/Features/Orders/Utils/OrderCustomExtraItemDto.cs`
- Modify: `api/AleTrack/AleTrack/Features/Orders/Commands/Create/{CreateOrderDto,CreateOrderEndpoint,CreateOrderValidator}.cs`, `.../Update/{UpdateOrderDto,UpdateOrderEndpoint,UpdateOrderValidator}.cs`

**Interfaces:**
- Consumes: `OrderClientExtraItem`, `OrderCustomExtraItem` from Task 1.
- Produces: `OrderClientExtraItemDto { Guid? Id; Guid InventoryItemId; int Quantity; string? Name; double? PackageSize; bool IsLoadingConfirmed }`, `OrderCustomExtraItemDto { Guid? Id; string Description; int Quantity; bool IsLoadingConfirmed }`, `CreateOrderDto.ClientExtraItems/.CustomExtraItems`, `UpdateOrderDto.ClientExtraItems/.CustomExtraItems`. Task 3 and Task 6 read these names.

- [ ] **Step 1: Create `OrderClientExtraItemDto.cs`**

```csharp
using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Orders.Utils;

/// <summary>
/// A dokládka on an order. Used for both read and write — <see cref="Id"/> is set
/// on read and on updates of an existing row, null for newly-added ones.
/// </summary>
public sealed record OrderClientExtraItemDto
{
    /// <summary>Public ID of the extra item (null when newly added).</summary>
    public Guid? Id { get; set; }

    /// <summary>Public ID of the inventory item the stock is taken from.</summary>
    public Guid InventoryItemId { get; set; }

    /// <summary>Quantity delivered to the client.</summary>
    public int Quantity { get; set; }

    /// <summary>Display name of the inventory item. Read-only; ignored on write.</summary>
    public string? Name { get; set; }

    /// <summary>Package size of the underlying product. Read-only; ignored on write.</summary>
    public double? PackageSize { get; set; }

    /// <summary>Whether loading was confirmed. Owned by the shipment; ignored on order write.</summary>
    public bool IsLoadingConfirmed { get; set; }
}

/// <summary>
/// Validates a dokládka row: a resolvable inventory item and a positive quantity.
/// Stock availability is deliberately not checked here — stock is only taken when
/// the shipment loads, so an order-time check would be a promise the model cannot keep.
/// </summary>
public sealed class OrderClientExtraItemDtoValidator : Validator<OrderClientExtraItemDto>
{
    public OrderClientExtraItemDtoValidator()
    {
        RuleFor(e => e.InventoryItemId).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(e => e.Quantity).GreaterThan(0).WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError);
    }
}
```

- [ ] **Step 2: Create `OrderCustomExtraItemDto.cs`**

```csharp
using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.Orders.Utils;

/// <summary>
/// A free-form extra on an order. Used for both read and write — <see cref="Id"/> is
/// set on read and on updates of an existing row, null for newly-added ones.
/// </summary>
public sealed record OrderCustomExtraItemDto
{
    /// <summary>Public ID of the extra item (null when newly added).</summary>
    public Guid? Id { get; set; }

    /// <summary>Description of the item.</summary>
    public string Description { get; set; } = null!;

    /// <summary>Quantity delivered to the client.</summary>
    public int Quantity { get; set; }

    /// <summary>Whether loading was confirmed. Owned by the shipment; ignored on order write.</summary>
    public bool IsLoadingConfirmed { get; set; }
}

/// <summary>
/// Validates a custom extra row: a non-empty description of at most 200 characters
/// and a positive quantity.
/// </summary>
public sealed class OrderCustomExtraItemDtoValidator : Validator<OrderCustomExtraItemDto>
{
    public OrderCustomExtraItemDtoValidator()
    {
        RuleFor(e => e.Description).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(e => e.Description).MaximumLength(200).WithErrorCode(ErrorCodes.ValidationMaxLengthError);
        RuleFor(e => e.Quantity).GreaterThan(0).WithErrorCode(ErrorCodes.ValidationMinValueNotMatchedError);
    }
}
```

- [ ] **Step 3: Add both lists to `CreateOrderDto` and `UpdateOrderDto`**

In each file add `using AleTrack.Features.Orders.Utils;` if absent, then after the existing `Returns` property:

```csharp
    /// <summary>
    /// Stock pulled from the inventory and delivered on top of this order (dokládka).
    /// </summary>
    public List<OrderClientExtraItemDto> ClientExtraItems { get; set; } = [];

    /// <summary>
    /// Free-form billable items delivered on top of this order.
    /// </summary>
    public List<OrderCustomExtraItemDto> CustomExtraItems { get; set; } = [];
```

- [ ] **Step 4: Write the failing tests**

Create `api/AleTrack/AleTrack.Tests/Features/Orders/OrderExtraItemsTests.cs`:

```csharp
using AleTrack.Entities;
using AleTrack.Features.Orders.Commands.Create;
using AleTrack.Features.Orders.Commands.Update;
using AleTrack.Features.Orders.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Orders;

/// <summary>
/// Extras belong to the order: created and edited with it, never invented by the shipment.
/// </summary>
public sealed class OrderExtraItemsTests
{
    [Fact]
    public async Task ProcessAsync_CreateOrder_PersistsBothExtraKinds()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId, officialAddress: AddressBuilder.BuildEntity());
        var productId = Guid.NewGuid();
        var product = ProductBuilder.BuildEntity(publicId: productId);

        var invId = Guid.NewGuid();
        var inventoryItem = new InventoryItem { Id = 7, PublicId = invId, Name = "Sud 50 l", Quantity = 20 };

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], products: [product], inventoryItems: [inventoryItem]);

        var command = new CreateOrderRequest
        {
            Data = OrderBuilder.BuildCreateDto(
                clientId: clientId,
                orderItems: [new CreateOrderItemDto { ProductId = productId, Quantity = 5 }],
                clientExtraItems: [new OrderClientExtraItemDto { InventoryItemId = invId, Quantity = 3 }],
                customExtraItems: [new OrderCustomExtraItemDto { Description = "Tácky", Quantity = 100 }])
        };

        var endpoint = EndpointBuilder<CreateOrderRequest, CreateOrderEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        var order = client.Orders.Should().ContainSingle().Subject;
        order.ClientExtraItems.Should().ContainSingle()
            .Which.Should().Match<OrderClientExtraItem>(e => e.InventoryItemId == 7 && e.Quantity == 3);
        order.CustomExtraItems.Should().ContainSingle()
            .Which.Should().Match<OrderCustomExtraItem>(e => e.Description == "Tácky" && e.Quantity == 100);

        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_CreateOrder_UnknownInventoryItem_Throws()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId, officialAddress: AddressBuilder.BuildEntity());
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client]);

        var command = new CreateOrderRequest
        {
            Data = OrderBuilder.BuildCreateDto(
                clientId: clientId,
                orderItems: [],
                clientExtraItems: [new OrderClientExtraItemDto { InventoryItemId = Guid.NewGuid(), Quantity = 1 }])
        };

        var endpoint = EndpointBuilder<CreateOrderRequest, CreateOrderEndpoint>.Create(dbContext.Object);
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrack.Common.Utils.AleTrackException>()
            .Where(e => e.ErrorCode == AleTrack.Common.Utils.ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task ProcessAsync_UpdateOrder_AddsEditsAndDropsExtras_PreservingLoadingFlag()
    {
        var orderId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId, officialAddress: AddressBuilder.BuildEntity());

        var invId = Guid.NewGuid();
        var inventoryItem = new InventoryItem { Id = 7, PublicId = invId, Name = "Sud 50 l", Quantity = 20 };

        var keptId = Guid.NewGuid();
        var kept = new OrderClientExtraItem
        {
            PublicId = keptId, InventoryItemId = 7, Quantity = 2, IsShipmentLoadingConfirmed = true
        };
        var droppedCustom = new OrderCustomExtraItem { PublicId = Guid.NewGuid(), Description = "Pryč", Quantity = 1 };

        var order = OrderBuilder.BuildEntity(
            publicId: orderId, client: client,
            clientExtraItems: [kept], customExtraItems: [droppedCustom]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [order], inventoryItems: [inventoryItem]);

        var command = new UpdateOrderRequest
        {
            Id = orderId,
            Data = OrderBuilder.BuildUpdateDto(
                clientId: clientId,
                orderItems: [],
                clientExtraItems: [new OrderClientExtraItemDto { Id = keptId, InventoryItemId = invId, Quantity = 9 }],
                customExtraItems: [new OrderCustomExtraItemDto { Description = "Nová", Quantity = 4 }])
        };

        var endpoint = EndpointBuilder<UpdateOrderRequest, UpdateOrderEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        var edited = order.ClientExtraItems.Should().ContainSingle().Subject;
        edited.PublicId.Should().Be(keptId);
        edited.Quantity.Should().Be(9);
        edited.IsShipmentLoadingConfirmed.Should().BeTrue("the order write must not clear a flag the shipment owns");

        order.CustomExtraItems.Should().ContainSingle().Which.Description.Should().Be("Nová");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void ClientExtraValidator_RejectsNonPositiveQuantity(int quantity)
    {
        new OrderClientExtraItemDtoValidator()
            .Validate(new OrderClientExtraItemDto { InventoryItemId = Guid.NewGuid(), Quantity = quantity })
            .IsValid.Should().BeFalse();
    }

    [Fact]
    public void CustomExtraValidator_RejectsBlankAndOverlongDescription()
    {
        var validator = new OrderCustomExtraItemDtoValidator();

        validator.Validate(new OrderCustomExtraItemDto { Description = "", Quantity = 1 }).IsValid.Should().BeFalse();
        validator.Validate(new OrderCustomExtraItemDto { Description = new string('x', 201), Quantity = 1 })
            .IsValid.Should().BeFalse();
        validator.Validate(new OrderCustomExtraItemDto { Description = "Tácky", Quantity = 1 })
            .IsValid.Should().BeTrue();
    }
}
```

- [ ] **Step 5: Extend `OrderBuilder` so the tests compile**

In `api/AleTrack/AleTrack.Tests/Builders/OrderBuilder.cs` add `using AleTrack.Features.Orders.Utils;` and, to all three factories, the parameters `List<OrderClientExtraItem>? clientExtraItems = null, List<OrderCustomExtraItem>? customExtraItems = null` (entity factory) or `List<OrderClientExtraItemDto>? clientExtraItems = null, List<OrderCustomExtraItemDto>? customExtraItems = null` (DTO factories), assigning `ClientExtraItems = clientExtraItems ?? []` and `CustomExtraItems = customExtraItems ?? []`.

Check whether `AleTrackDbContextMockFactory.CreateMock` already accepts `inventoryItems:`; if not, add it following the existing `orders:` parameter.

- [ ] **Step 6: Run the tests to verify they fail**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~OrderExtraItemsTests"`
Expected: compile error or FAIL — the endpoints do not read the new lists yet.

- [ ] **Step 7: Implement in `CreateOrderEndpoint`**

After the existing `Returns`/`Notes` loops, resolve inventory items by public id and add rows; throw `ThrowHelper.PublicEntityNotFound(nameof(InventoryItem), id)` for an unresolvable one:

```csharp
        var extraInventoryIds = req.Data.ClientExtraItems.Select(e => e.InventoryItemId).ToList();
        var inventoryItems = extraInventoryIds.Count == 0
            ? []
            : await dbContext.InventoryItems.Where(i => extraInventoryIds.Contains(i.PublicId)).ToListAsync(ct);

        foreach (var extra in req.Data.ClientExtraItems)
        {
            var inventoryItem = inventoryItems.FirstOrDefault(i => i.PublicId == extra.InventoryItemId);
            if (inventoryItem is null)
                ThrowHelper.PublicEntityNotFound(nameof(InventoryItem), extra.InventoryItemId);

            order.ClientExtraItems.Add(new OrderClientExtraItem
            {
                InventoryItem = inventoryItem!,
                Quantity = extra.Quantity
            });
        }

        foreach (var extra in req.Data.CustomExtraItems)
        {
            order.CustomExtraItems.Add(new OrderCustomExtraItem
            {
                Description = extra.Description,
                Quantity = extra.Quantity
            });
        }
```

- [ ] **Step 8: Implement in `UpdateOrderEndpoint`**

Add `.Include(o => o.ClientExtraItems)` and `.Include(o => o.CustomExtraItems)` to the query, assign after the `Notes` assignment, and add two diff helpers beside `GetReturns` / `GetNotes`. `IsShipmentLoadingConfirmed` is **never** written here — it belongs to the shipment:

```csharp
        order.ClientExtraItems = await GetClientExtrasAsync(req.Data.ClientExtraItems, order, ct);
        order.CustomExtraItems = GetCustomExtras(req.Data.CustomExtraItems, order);
```

```csharp
    /// <summary>
    /// Diffs posted dokládka rows against the persisted ones. Rows without an ID are
    /// new; rows matching a persisted PublicId are updated in place, deliberately
    /// leaving <see cref="OrderClientExtraItem.IsShipmentLoadingConfirmed"/> alone —
    /// that flag is the shipment's, and an order edit must not silently un-confirm a
    /// loaded item. Anything left out is dropped.
    /// </summary>
    private async Task<List<OrderClientExtraItem>> GetClientExtrasAsync(
        List<OrderClientExtraItemDto> extras, Order order, CancellationToken ct)
    {
        var result = new List<OrderClientExtraItem>();

        var newRows = extras.Where(e => e.Id is null).ToList();
        if (newRows.Count > 0)
        {
            var ids = newRows.Select(e => e.InventoryItemId).ToList();
            var inventoryItems = await dbContext.InventoryItems
                .Where(i => ids.Contains(i.PublicId))
                .ToListAsync(ct);

            foreach (var e in newRows)
            {
                var inventoryItem = inventoryItems.FirstOrDefault(i => i.PublicId == e.InventoryItemId);
                if (inventoryItem is null)
                    ThrowHelper.PublicEntityNotFound(nameof(InventoryItem), e.InventoryItemId);

                result.Add(new OrderClientExtraItem { InventoryItem = inventoryItem!, Quantity = e.Quantity });
            }
        }

        foreach (var e in extras.Where(e => e.Id is not null && order.ClientExtraItems.Any(x => x.PublicId == e.Id!.Value)))
        {
            var existing = order.ClientExtraItems.First(x => x.PublicId == e.Id!.Value);
            existing.Quantity = e.Quantity;
            result.Add(existing);
        }

        return result;
    }

    /// <summary>
    /// Same diff for free-form extras. <see cref="OrderCustomExtraItem.IsShipmentLoadingConfirmed"/>
    /// is likewise left to the shipment.
    /// </summary>
    private static List<OrderCustomExtraItem> GetCustomExtras(List<OrderCustomExtraItemDto> extras, Order order)
    {
        var result = extras
            .Where(e => e.Id is null)
            .Select(e => new OrderCustomExtraItem { Description = e.Description, Quantity = e.Quantity })
            .ToList();

        foreach (var e in extras.Where(e => e.Id is not null && order.CustomExtraItems.Any(x => x.PublicId == e.Id!.Value)))
        {
            var existing = order.CustomExtraItems.First(x => x.PublicId == e.Id!.Value);
            existing.Description = e.Description;
            existing.Quantity = e.Quantity;
            result.Add(existing);
        }

        return result;
    }
```

- [ ] **Step 9: Wire both validators**

In `CreateOrderValidator`'s `CreateOrderDtoValidator` and `UpdateOrderValidator`'s `UpdateOrderDtoValidator`, beside the existing `Returns` rule:

```csharp
        RuleFor(r => r.ClientExtraItems)
            .ForEach(e => e.SetValidator(new OrderClientExtraItemDtoValidator()))
            .When(r => r.ClientExtraItems.Count > 0);

        RuleFor(r => r.CustomExtraItems)
            .ForEach(e => e.SetValidator(new OrderCustomExtraItemDtoValidator()))
            .When(r => r.CustomExtraItems.Count > 0);
```

- [ ] **Step 10: Run the tests**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~OrderExtraItemsTests"`
Expected: PASS, 6 tests. (The rest of the solution is still red — Tasks 3–5.)

- [ ] **Step 11: Commit**

```bash
git add api/AleTrack/AleTrack/Features/Orders api/AleTrack/AleTrack.Tests
git commit -m "feat(orders): create and edit extra items on the order"
```

---

### Task 3: Order detail read path

**Files:**
- Modify: `api/AleTrack/AleTrack/Features/Orders/Queries/Detail/OrderDto.cs`, `.../GetOrderDetailEndpoint.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/Orders/OrderExtraItemsTests.cs`

**Interfaces:**
- Produces: `OrderDto.ClientExtraItems`, `OrderDto.CustomExtraItems` — Task 7 and Task 8 render these.

- [ ] **Step 1: Write the failing test**

Append to `OrderExtraItemsTests`:

```csharp
    [Fact]
    public async Task ProcessAsync_GetOrderDetail_ProjectsBothExtraKinds()
    {
        var orderId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());

        var product = ProductBuilder.BuildEntity(name: "Ležák 12°");
        product.PackageSize = 50;
        var inventoryItem = new InventoryItem { Id = 7, PublicId = Guid.NewGuid(), Name = "Sud 50 l", Quantity = 20, Product = product };

        var extraId = Guid.NewGuid();
        var order = OrderBuilder.BuildEntity(
            publicId: orderId, client: client,
            clientExtraItems: [new OrderClientExtraItem { PublicId = extraId, InventoryItem = inventoryItem, InventoryItemId = 7, Quantity = 3 }],
            customExtraItems: [new OrderCustomExtraItem { PublicId = Guid.NewGuid(), Description = "Tácky", Quantity = 100 }]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client], orders: [order]);

        var endpoint = EndpointWithResponseBuilder<GetOrderDetailRequest, OrderDto, GetOrderDetailEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new GetOrderDetailRequest { Id = orderId }, CancellationToken.None);

        var extra = endpoint.Response.ClientExtraItems.Should().ContainSingle().Subject;
        extra.Id.Should().Be(extraId);
        extra.Name.Should().Be("Sud 50 l");
        extra.PackageSize.Should().Be(50);
        extra.Quantity.Should().Be(3);

        endpoint.Response.CustomExtraItems.Should().ContainSingle().Which.Description.Should().Be("Tácky");
    }
```

Add `using AleTrack.Features.Orders.Queries.Detail;` to the file's usings.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ProjectsBothExtraKinds"`
Expected: compile error — `OrderDto.ClientExtraItems` does not exist.

- [ ] **Step 3: Add both lists to `OrderDto`**

```csharp
    /// <summary>
    /// Stock pulled from the inventory and delivered on top of this order (dokládka)
    /// </summary>
    public List<OrderClientExtraItemDto> ClientExtraItems { get; set; } = [];

    /// <summary>
    /// Free-form billable items delivered on top of this order
    /// </summary>
    public List<OrderCustomExtraItemDto> CustomExtraItems { get; set; } = [];
```

- [ ] **Step 4: Project them in `GetOrderDetailEndpoint`**

After the `Returns` projection:

```csharp
                ClientExtraItems = o.ClientExtraItems
                    .Select(e => new OrderClientExtraItemDto
                    {
                        Id = e.PublicId,
                        InventoryItemId = e.InventoryItem.PublicId,
                        Quantity = e.Quantity,
                        Name = e.InventoryItem.Name ?? (e.InventoryItem.Product != null ? e.InventoryItem.Product.Name : null),
                        PackageSize = e.InventoryItem.Product != null ? e.InventoryItem.Product.PackageSize : null,
                        IsLoadingConfirmed = e.IsShipmentLoadingConfirmed
                    })
                    .ToList(),
                CustomExtraItems = o.CustomExtraItems
                    .Select(e => new OrderCustomExtraItemDto
                    {
                        Id = e.PublicId,
                        Description = e.Description,
                        Quantity = e.Quantity,
                        IsLoadingConfirmed = e.IsShipmentLoadingConfirmed
                    })
                    .ToList(),
```

- [ ] **Step 5: Run the test**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~OrderExtraItemsTests"`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add api/AleTrack/AleTrack/Features/Orders api/AleTrack/AleTrack.Tests
git commit -m "feat(orders): return extra items from the order detail"
```

---

### Task 4: Shipment read, confirmation write-through, stock

**Files:**
- Create: `api/AleTrack/AleTrack/Features/OutgoingShipments/Utils/ExtraItemInfoDto.cs`
- Modify: `.../Utils/ClientOrderShipmentDto.cs`, `.../Queries/Detail/OutgoingShipmentDetailDto.cs`, `.../Queries/Detail/GetOutgoingShipmentDetailEndpoint.cs`, `.../Commands/Create/{CreateOutgoingShipmentDto,CreateOutgoingShipmentEndpoint}.cs`, `.../Commands/Update/{UpdateOutgoingShipmentDto,UpdateOutgoingShipmentEndpoint}.cs`, `.../Utils/ExtraShipmentDtoValidator.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentExtraItemConfirmationTests.cs`

**Interfaces:**
- Consumes: `Order.ClientExtraItems`, `Order.CustomExtraItems` (Task 1); `OrderClientExtraItemDto`, `OrderCustomExtraItemDto` (Task 2).
- Produces: `ExtraItemInfoDto { Guid Id; bool IsLoadingConfirmed }`; `ClientOrderShipmentDto.ClientExtraItems/.CustomExtraItems` (both `List<ExtraItemInfoDto>`); `OutgoingShipmentStopDto.ClientExtraItems/.CustomExtraItems` (both read DTO lists). Task 6 consumes the stop lists.

- [ ] **Step 1: Create `ExtraItemInfoDto.cs`**

```csharp
namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// Confirm-only reference to an extra item owned by a stop's order. The shipment may
/// flip the loading flag; it may not create or delete the row, so no payload beyond
/// the identity is accepted.
/// </summary>
public sealed record ExtraItemInfoDto
{
    /// <summary>Public ID of the extra item.</summary>
    public Guid Id { get; set; }

    /// <summary>Whether loading of this extra item is confirmed.</summary>
    public bool IsLoadingConfirmed { get; set; }
}
```

- [ ] **Step 2: Write the failing tests**

Create `api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentExtraItemConfirmationTests.cs`. Model the shipment/stop/order setup on the existing `GetOutgoingShipmentDetailReturnsTests`. Cover:

1. `Update_ConfirmsLoading_OnTheOrdersExtraRow` — post `ClientOrderShipmentDto.ClientExtraItems = [{ Id = extraPublicId, IsLoadingConfirmed = true }]`; assert `order.ClientExtraItems.Single().IsShipmentLoadingConfirmed` is true.
2. `Update_UnknownExtraId_IsIgnored_NotCreated` — post an id no order holds; assert the order's collection count is unchanged and no exception is thrown.
3. `Update_TransitionToLoaded_SubtractsOrderExtrasFromInventory` — inventory `Quantity = 20`, extra `Quantity = 3`, state → `Loaded`; assert inventory `Quantity == 17`.
4. `Update_Cancel_ResetsExtraLoadingFlags` — a confirmed extra plus state → `Cancelled`; assert the flag is false.
5. `GetDetail_ProjectsExtrasPerStop_EmptyForCustomStop` — assert an order stop carries its extras and a custom stop's lists are empty.

- [ ] **Step 3: Run to verify they fail**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentExtraItemConfirmationTests"`
Expected: compile errors — the DTO members do not exist yet.

- [ ] **Step 4: Replace the shipment write path with confirm-only lists**

In `ClientOrderShipmentDto`:

```csharp
    /// <summary>
    /// Loading confirmation for the order's dokládka rows. Confirm-only: unknown IDs are ignored.
    /// </summary>
    public List<ExtraItemInfoDto> ClientExtraItems { get; set; } = [];

    /// <summary>
    /// Loading confirmation for the order's free-form extra rows. Confirm-only.
    /// </summary>
    public List<ExtraItemInfoDto> CustomExtraItems { get; set; } = [];
```

Delete `ClientExtraShipments` and `CustomExtraShipments` from `CreateOutgoingShipmentDto` and `UpdateOutgoingShipmentDto`, and their validators from `ExtraShipmentDtoValidator.cs`. **Keep `InventoryExtraShipments` and its validator.**

- [ ] **Step 5: Apply confirmations in `UpdateOutgoingShipmentEndpoint`**

Delete `GetClientExtraItemsAsync` and `GetCustomExtraItems` and the two `outgoingShipment.*ExtraItems = ...` assignments. In the loop that already walks `req.Data.ClientOrderShipments` to apply `OrderItems` confirmations, add:

```csharp
            foreach (var info in shipmentOrder.ClientExtraItems)
            {
                // Unknown IDs are ignored rather than created: the shipment confirms
                // extras, it does not author them.
                var extra = order.ClientExtraItems.FirstOrDefault(e => e.PublicId == info.Id);
                if (extra is not null)
                    extra.IsShipmentLoadingConfirmed = info.IsLoadingConfirmed;
            }

            foreach (var info in shipmentOrder.CustomExtraItems)
            {
                var extra = order.CustomExtraItems.FirstOrDefault(e => e.PublicId == info.Id);
                if (extra is not null)
                    extra.IsShipmentLoadingConfirmed = info.IsLoadingConfirmed;
            }
```

Ensure the shipment query `Include`s `Stops.ClientOrder.ClientExtraItems` (`.ThenInclude(e => e.InventoryItem)`) and `Stops.ClientOrder.CustomExtraItems`.

- [ ] **Step 6: Repoint stock subtraction and the cancellation reset**

```csharp
        if (isTransitioningToLoaded)
            SubtractFromInventory(outgoingShipment);
```

```csharp
    /// <summary>
    /// Takes each order's dokládka out of stock. Runs on the transition to Loaded —
    /// stock is consumed when the truck is packed, not when the order is written.
    /// </summary>
    private static void SubtractFromInventory(OutgoingShipment outgoingShipment)
    {
        foreach (var stop in outgoingShipment.Stops.Where(s => s.ClientOrder is not null))
        foreach (var extra in stop.ClientOrder!.ClientExtraItems)
            extra.InventoryItem.Quantity -= extra.Quantity;
    }

    private static void ResetOrderItemsForReuse(OutgoingShipment outgoingShipment)
    {
        // Null-guarded: a custom stop has no order. The previous version dereferenced
        // ClientOrder unconditionally and would NRE on a route with a custom stop.
        foreach (var stop in outgoingShipment.Stops.Where(s => s.ClientOrder is not null))
        {
            foreach (var orderItem in stop.ClientOrder!.OrderItems)
                orderItem.IsShipmentLoadingConfirmed = false;

            foreach (var extra in stop.ClientOrder.ClientExtraItems)
                extra.IsShipmentLoadingConfirmed = false;

            foreach (var extra in stop.ClientOrder.CustomExtraItems)
                extra.IsShipmentLoadingConfirmed = false;
        }
    }
```

- [ ] **Step 7: Move the read projection onto the stop**

In `OutgoingShipmentDetailDto`, delete the root `ClientExtraItems` and `CustomExtraItems` (keep `InventoryExtraItems`) and add to `OutgoingShipmentStopDto`, beside its `Returns`:

```csharp
    /// <summary>
    /// Dokládka rows on this stop's order (order stops only; always empty for a custom stop).
    /// </summary>
    public List<OrderClientExtraItemDto> ClientExtraItems { get; set; } = [];

    /// <summary>
    /// Free-form extra rows on this stop's order (order stops only).
    /// </summary>
    public List<OrderCustomExtraItemDto> CustomExtraItems { get; set; } = [];
```

Project them in `GetOutgoingShipmentDetailEndpoint` beside the stop's `Returns`, using the same field mapping as Task 3 Step 4, with `s.ClientOrder != null ? ... : new List<...>()`. Delete the two root projections.

- [ ] **Step 8: Run the shipment tests**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentExtraItemConfirmationTests"`
Expected: PASS, 5 tests.

- [ ] **Step 9: Commit**

```bash
git add api/AleTrack/AleTrack/Features/OutgoingShipments api/AleTrack/AleTrack.Tests
git commit -m "feat(shipments): confirm order-owned extras, drop the write path"
```

---

### Task 5: Invoicing, migration, green build

**Files:**
- Modify: `.../Utils/ShipmentInvoiceGraph.cs:25-27,69-71,121-124`, `.../Utils/ShipmentInvoiceReconciler.cs:264-287`
- Create: migration `MoveExtraItemsToOrders`

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: a green solution and an applied schema. Task 6 needs the API running to regenerate the client.

- [ ] **Step 1: Repoint `ShipmentInvoiceGraph` loading and resolution**

Replace the three `.Include(s => s.ClientExtraItems)…` / `.Include(s => s.CustomExtraItems)…` lines with includes through the stop:

```csharp
            .Include(s => s.Stops).ThenInclude(st => st.ClientOrder!).ThenInclude(o => o.ClientExtraItems)
                .ThenInclude(e => e.InventoryItem).ThenInclude(i => i.Product)
            .Include(s => s.Stops).ThenInclude(st => st.ClientOrder!).ThenInclude(o => o.CustomExtraItems)
```

Add a helper and use it in `ResolveSourceItemId` and `EligibleClientIds`:

```csharp
    /// <summary>Order-owned extras reachable from this shipment's stops.</summary>
    private static IEnumerable<OrderClientExtraItem> ClientExtrasOf(OutgoingShipment shipment) => shipment.Stops
        .Where(s => s.ClientOrder is not null)
        .SelectMany(s => s.ClientOrder!.ClientExtraItems);

    private static IEnumerable<OrderCustomExtraItem> CustomExtrasOf(OutgoingShipment shipment) => shipment.Stops
        .Where(s => s.ClientOrder is not null)
        .SelectMany(s => s.ClientOrder!.CustomExtraItems);
```

`EligibleClientIds` no longer needs its two extra loops at all — every extra hangs off a stop's order, whose client is already in the set from the first `ToHashSet()`. Delete both loops and leave the stop-derived ids plus the existing-invoice ids.

- [ ] **Step 2: Repoint `ShipmentInvoiceReconciler` source collection**

Replace both `foreach` blocks (lines ~264 and ~277). The `Where(i => i.ClientId is not null)` filters and the `!.Value` unwraps disappear — the client comes from the owning order:

```csharp
        foreach (var stop in shipment.Stops.Where(s => s.ClientOrder is not null))
        {
            foreach (var item in stop.ClientOrder!.ClientExtraItems)
            {
                sources.Add(new BillableSource
                {
                    Kind = InvoiceLineSourceKind.ClientExtraItem,
                    ItemId = RequirePersisted(item.Id, nameof(OrderClientExtraItem)),
                    OrderingClientId = stop.ClientOrder.ClientId,
                    OrderingClient = stop.ClientOrder.Client,
                    Quantity = item.Quantity,
                    Name = item.InventoryItem?.Name ?? item.InventoryItem?.Product?.Name
                });
            }

            foreach (var item in stop.ClientOrder.CustomExtraItems)
            {
                sources.Add(new BillableSource
                {
                    Kind = InvoiceLineSourceKind.CustomExtraItem,
                    ItemId = RequirePersisted(item.Id, nameof(OrderCustomExtraItem)),
                    OrderingClientId = stop.ClientOrder.ClientId,
                    OrderingClient = stop.ClientOrder.Client,
                    Quantity = item.Quantity,
                    Name = item.Description
                });
            }
        }
```

- [ ] **Step 3: Build until green**

Run: `cd api/AleTrack && dotnet build AleTrack.sln 2>&1 | grep -E ": error" | sort -u`
Expected: no output. Fix any remaining references to the deleted entities until this is clean.

- [ ] **Step 4: Run the whole backend suite**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj`
Expected: all pass — 149 pre-existing plus the 12 added in Tasks 2–4, so **161**. Existing invoicing tests that construct shipment-owned extras must be rewritten to hang them off a stop's order, not deleted.

- [ ] **Step 5: Scaffold and review the migration**

Run: `cd api/AleTrack/AleTrack && dotnet ef migrations add MoveExtraItemsToOrders`
Verify the `Up` drops `outgoing_shipment_client_extra_items` and `outgoing_shipment_custom_extra_items`, creates `order_client_extra_items` and `order_custom_extra_items`, and **does not touch** `outgoing_shipment_inventory_extra_items`. The invoice-line FKs re-point at the new tables.

- [ ] **Step 6: Apply it locally**

Run: `dotnet ef database update --connection "Host=localhost;Port=5432;Database=AleTrack;Username=postgres;Password=postgres"`
Expected: `Applying migration '<stamp>_MoveExtraItemsToOrders'. Done.`

- [ ] **Step 7: Commit**

```bash
git add api/AleTrack
git commit -m "refactor(invoicing): bill extras through the owning order"
```

---

### Task 6: Regenerate the client, update the shipment screens

**Files:**
- Modify: `app/src/generated/api-client.ts` (generated), `app/src/features/shipments/shipmentDraft.ts`, `app/src/features/shipments/ShipmentDetail.tsx`

**Interfaces:**
- Consumes: `OutgoingShipmentStopDto.clientExtraItems/.customExtraItems`, `ClientOrderShipmentDto.clientExtraItems/.customExtraItems` (Task 4).
- Produces: a draft whose confirmations round-trip per stop.

- [ ] **Step 1: Regenerate the API client**

Start the API on a spare port so a backend you already have on 8080 is untouched, then generate against it:

```bash
cd api/AleTrack && eval "$(python3 -c "
import json,shlex
d=json.load(open('AleTrack/Properties/launchSettings.json',encoding='utf-8-sig'))
print(' '.join(f'{k}={shlex.quote(str(v))}' for k,v in d['profiles']['Local']['environmentVariables'].items()))
") ASPNETCORE_URLS=http://localhost:8099 dotnet run --project AleTrack --no-launch-profile" &
cd app && python3 -c "
import json
d=json.load(open('nswag.json'))
d['documentGenerator']['fromDocument']['url']='http://localhost:8099/swagger/v1/swagger.json'
json.dump(d,open('nswag.local.json','w'),indent=2)
" && yarn nswag run nswag.local.json && rm -f nswag.local.json
```

Stop the API afterwards: `lsof -nP -iTCP:8099 -sTCP:LISTEN -t | xargs -r kill`.
Verify: `rg -c "class OrderClientExtraItemDto" app/src/generated/api-client.ts` returns 1.

- [ ] **Step 2: Move the extras into the per-stop draft**

In `shipmentDraft.ts` remove `clientExtraShipments` and `customExtraShipments` from `ShipmentDraft` and `draftFromShipment`, and add to each `ClientOrderShipmentDto` built from an order stop:

```ts
      clientExtraItems: (st.clientExtraItems ?? []).map((e) => new ExtraItemInfoDto({
        id: e.id, isLoadingConfirmed: e.isLoadingConfirmed,
      })),
      customExtraItems: (st.customExtraItems ?? []).map((e) => new ExtraItemInfoDto({
        id: e.id, isLoadingConfirmed: e.isLoadingConfirmed,
      })),
```

Keep `inventoryExtraShipments` exactly as it is.

- [ ] **Step 3: Remove the two dokládka dialogs from `ShipmentDetail.tsx`**

Delete the `dokladkaOpen` / `extraName` state, their handlers, both `<Dialog>` blocks (from `ShipmentDetail.tsx:832`) and the buttons opening them. Source the nakládka rows from `stopsSorted.flatMap((st) => st.clientExtraItems ?? [])` and `…customExtraItems` instead of `shipment.clientExtraItems` / `shipment.customExtraItems`, keeping the loading checkboxes and writing confirmations back through the stop's draft entry.

- [ ] **Step 4: Typecheck and test**

Run: `cd app && yarn tsc --noEmit && yarn vitest run`
Expected: tsc clean; 92 tests pass (`ReturnsCard.test.tsx` must be unaffected).

- [ ] **Step 5: Commit**

```bash
git add app/src/generated/api-client.ts app/src/features/shipments
git commit -m "feat(shipments): confirm extras per stop, drop the dokládka dialogs"
```

---

### Task 7: Order editor

**Files:**
- Modify: `app/src/features/orders/OrderEditor.tsx`
- Test: `app/src/features/orders/OrderEditorExtras.test.tsx`

**Interfaces:**
- Consumes: `OrderClientExtraItemDto`, `OrderCustomExtraItemDto`, `useInventory()`.
- Note: `useInventory()` returns **brewery-grouped sections**, so flatten with `(inventoryQuery.data ?? []).flatMap((s) => s.items ?? [])` — the same shape `ShipmentDetail.tsx:584` used.

- [ ] **Step 1: Write the failing tests**

Extend `OrderEditorExtras.test.tsx` with a `describe('OrderEditor — položky navíc')` covering: adding a stock row caps quantity at what is on hand; adding a custom row; removing a row; an extras edit alone marks the form dirty; and the save payload carries `clientExtraItems` with the inventory item's id and `customExtraItems` with the description. Add a `vi.mock('src/hooks/useInventory', …)` returning one section with one item of `quantity: 20`.

- [ ] **Step 2: Run to verify they fail**

Run: `cd app && yarn vitest run src/features/orders/OrderEditorExtras.test.tsx`
Expected: FAIL — no "Položky navíc" card.

- [ ] **Step 3: Implement the card**

Add `DraftClientExtra { id?: string; inventoryItemId: string; quantity: number }` and `DraftCustomExtra { id?: string; description: string; quantity: number }`, both in `serializeForm`'s snapshot. Render a "Položky navíc" card below Vratky with a `Combobox` over flattened stock plus a quantity field capped at that item's `quantity`, and a second sub-section for custom rows (description + quantity). Send both in `persist()`, dropping rows with no inventory item / blank description.

- [ ] **Step 4: Run the tests**

Run: `cd app && yarn vitest run src/features/orders/OrderEditorExtras.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/features/orders
git commit -m "feat(orders): add extra items in the order editor"
```

---

### Task 8: Order detail card and final verification

**Files:**
- Modify: `app/src/features/orders/OrderDetail.tsx`
- Test: `app/src/features/orders/OrderDetail.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `OrderDetail.test.tsx`: both extra kinds render in a "Položky navíc" card; the card is hidden when both are empty; and `cardTitles(container)` equals `['Položky', 'Vratky', 'Položky navíc', 'Poznámky']` when all are present. Extend the `cardTitles` filter with `'Položky navíc'`.

- [ ] **Step 2: Run to verify they fail**

Run: `cd app && yarn vitest run src/features/orders/OrderDetail.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Add `const clientExtras = order.clientExtraItems ?? []` and `const customExtras = order.customExtraItems ?? []`, include both in `hasSidebar`, and render a read-only "Položky navíc" card between Vratky and Poznámky — client rows showing name + package size, custom rows their description, each with `{quantity}×`.

- [ ] **Step 4: Full verification**

```bash
cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj
cd app && yarn tsc --noEmit && yarn lint && yarn vitest run
```
Expected: 161 backend pass; tsc clean; lint 0 errors / 4 known warnings; frontend all pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/features/orders
git commit -m "feat(orders): show extra items on the order detail"
```
