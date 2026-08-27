using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Commands.SetOrderItemSourcing;
using AleTrack.Features.OutgoingShipments.Commands.SetState;
using AleTrack.Features.OutgoingShipments.Commands.SetStockPurchase;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// The two one-field writes the nakládka makes over and over: advancing the run's state, and
/// moving a piece between "z pivovaru" and "z garáže".
/// </summary>
/// <remarks>
/// Both used to go through the full-object PUT, which re-posted and rebuilt the whole run to
/// change one field. These endpoints exist so a click costs one narrow write; the tests below
/// pin the behaviour that must survive that narrowing — above all the stock arithmetic, which
/// is the part a second copy of the transition would have silently got wrong.
/// </remarks>
public sealed class ShipmentStateEndpointTests
{
    private sealed record Fixture(
        OutgoingShipment Shipment,
        Order Order,
        OrderItem Item,
        InventoryItem Stock,
        Client Client,
        Vehicle Vehicle);

    private static Fixture BuildFixture(
        OutgoingShipmentState state = OutgoingShipmentState.Created,
        int ordered = 20,
        int stockQuantity = 40,
        int fromInventory = 0)
    {
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        client.Id = 11;

        var product = ProductBuilder.BuildEntity(name: "Svijanský Máz");
        product.Brewery = BreweryBuilder.BuildEntity();

        var stock = new InventoryItem
        {
            Id = 31, PublicId = Guid.NewGuid(), Name = "Svijanský Máz", Quantity = stockQuantity, Product = product
        };

        var item = new OrderItem { Id = 51, PublicId = Guid.NewGuid(), Product = product, Quantity = ordered };
        if (fromInventory > 0)
        {
            item.QuantityFromInventory = fromInventory;
            item.InventoryItem = stock;
            item.InventoryItemId = stock.Id;
        }

        var order = OrderBuilder.BuildEntity(client: client, state: OrderState.Planning, orderItems: [item]);
        order.Id = 101;
        order.ClientId = 11;

        var vehicle = VehicleBuilder.BuildEntity();

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            state: state,
            stops:
            [
                new OutgoingShipmentStop
                {
                    PublicId = Guid.NewGuid(), Kind = OutgoingShipmentStopKind.Order, Order = 1, ClientOrder = order
                }
            ]);
        shipment.DeliveryDate = DateTime.UtcNow.AddDays(1);
        shipment.Vehicle = vehicle;
        shipment.VehicleId = vehicle.Id;
        shipment.Drivers.Add(new OutgoingShipmentDriver { Driver = DriverBuilder.BuildEntity() });

        return new Fixture(shipment, order, item, stock, client, vehicle);
    }

    private static Mock<AleTrack.Infrastructure.Persistence.AleTrackDbContext> MockFor(Fixture f)
    {
        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [f.Client], orders: [f.Order], outgoingShipments: [f.Shipment], inventoryItems: [f.Stock]);
        db.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        return db;
    }

    private static SetShipmentStateEndpoint StateEndpoint(Mock<AleTrack.Infrastructure.Persistence.AleTrackDbContext> db) =>
        EndpointBuilder<SetShipmentStateRequest, SetShipmentStateEndpoint>
            .Create(db.Object, DriverScopeMockFactory.Unscoped());

    private static SetOrderItemSourcingEndpoint SourcingEndpoint(Mock<AleTrack.Infrastructure.Persistence.AleTrackDbContext> db) =>
        EndpointBuilder<SetOrderItemSourcingRequest, SetOrderItemSourcingEndpoint>
            .Create(db.Object, DriverScopeMockFactory.Unscoped());

    private static SetShipmentStateRequest StateRequest(Fixture f, OutgoingShipmentState state) => new()
    {
        Id = f.Shipment.PublicId,
        Data = new SetShipmentStateDto { State = state }
    };

    private static SetOrderItemSourcingRequest SourcingRequest(Fixture f, int quantity, Guid? inventoryId = null) => new()
    {
        Id = f.Shipment.PublicId,
        OrderItemId = f.Item.PublicId,
        Data = new SetOrderItemSourcingDto
        {
            QuantityFromInventory = quantity,
            InventoryItemId = quantity > 0 ? inventoryId ?? f.Stock.PublicId : null
        }
    };

    // -----------------------------------------------------------------------------------
    // The state endpoint.
    // -----------------------------------------------------------------------------------

    [Fact]
    public async Task SetState_MovesTheShipmentAndItsOrders()
    {
        var f = BuildFixture();

        await StateEndpoint(MockFor(f)).HandleAsync(StateRequest(f, OutgoingShipmentState.Loaded), CancellationToken.None);

        f.Shipment.State.Should().Be(OutgoingShipmentState.Loaded);
        f.Order.State.Should().Be(OrderState.Planning);
    }

    [Fact]
    public async Task SetState_ToInTransit_PutsTheOrdersOutForDelivery()
    {
        var f = BuildFixture(state: OutgoingShipmentState.Loaded);

        await StateEndpoint(MockFor(f)).HandleAsync(StateRequest(f, OutgoingShipmentState.InTransit), CancellationToken.None);

        f.Order.State.Should().Be(OrderState.Delivering);
    }

    [Fact]
    public async Task SetState_IllegalTransition_IsRejected()
    {
        var f = BuildFixture();

        var act = async () => await StateEndpoint(MockFor(f))
            .HandleAsync(StateRequest(f, OutgoingShipmentState.Delivered), CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.ShipmentTransitionNotAllowed);
    }

    [Fact]
    public async Task SetState_UnknownShipment_IsNotFound()
    {
        var f = BuildFixture();

        var act = async () => await StateEndpoint(MockFor(f)).HandleAsync(
            new SetShipmentStateRequest
            {
                Id = Guid.NewGuid(), Data = new SetShipmentStateDto { State = OutgoingShipmentState.Loaded }
            },
            CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task SetState_ToLoadedWithoutStops_IsRejected()
    {
        var f = BuildFixture();
        f.Shipment.Stops.Clear();

        var act = async () => await StateEndpoint(MockFor(f))
            .HandleAsync(StateRequest(f, OutgoingShipmentState.Loaded), CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.ShipmentCannotBeLoadedWithoutStops);
    }

    [Fact]
    public async Task SetState_ToInTransitWithoutAVan_IsRejected()
    {
        var f = BuildFixture(state: OutgoingShipmentState.Loaded);
        f.Shipment.VehicleId = null;

        var act = async () => await StateEndpoint(MockFor(f))
            .HandleAsync(StateRequest(f, OutgoingShipmentState.InTransit), CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.ShipmentNotPrepared);
    }

    /// <summary>
    /// The other half of the same readiness rule: a van with nobody in it does not leave.
    /// </summary>
    /// <remarks>
    /// Pinned because the detail screen now reads this rule to decide whether to offer "Vyrazit"
    /// (app/src/features/shipments/departureReadiness.ts). A relaxation here would leave the two
    /// disagreeing, with a button the office cannot press on a run the API would have let go.
    /// </remarks>
    [Fact]
    public async Task SetState_ToInTransitWithoutADriver_IsRejected()
    {
        var f = BuildFixture(state: OutgoingShipmentState.Loaded);
        f.Shipment.Drivers.Clear();

        var act = async () => await StateEndpoint(MockFor(f))
            .HandleAsync(StateRequest(f, OutgoingShipmentState.InTransit), CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.ShipmentNotPrepared);
    }

    // -----------------------------------------------------------------------------------
    // Stock, drawn and returned.
    //
    // The reported bug: 40 on hand, 30 sourced onto a run. Loading took the 30 out, leaving
    // 10 — but nothing put them back when the run was reverted, so the next load took another
    // 30 and the on-hand figure walked downwards on every round trip.
    // -----------------------------------------------------------------------------------

    [Fact]
    public async Task SetState_ToLoaded_DrawsTheSourcedPiecesDown()
    {
        var f = BuildFixture(ordered: 30, stockQuantity: 40, fromInventory: 30);

        await StateEndpoint(MockFor(f)).HandleAsync(StateRequest(f, OutgoingShipmentState.Loaded), CancellationToken.None);

        f.Stock.Quantity.Should().Be(10);
    }

    [Fact]
    public async Task SetState_RevertingToCreated_PutsTheDrawnPiecesBack()
    {
        var f = BuildFixture(state: OutgoingShipmentState.Loaded, ordered: 30, stockQuantity: 10, fromInventory: 30);

        await StateEndpoint(MockFor(f)).HandleAsync(StateRequest(f, OutgoingShipmentState.Created), CancellationToken.None);

        f.Stock.Quantity.Should().Be(40, "unpacking the run returns what it took");
        f.Item.QuantityFromInventory.Should().Be(30, "reverting reopens the plan; it does not discard it");
    }

    [Fact]
    public async Task SetState_LoadRevertLoad_DrawsTheSamePiecesOnlyOnce()
    {
        // The round trip that made the on-hand figure drift. Two loads must leave stock where
        // one load left it, not twice as low.
        var f = BuildFixture(ordered: 30, stockQuantity: 40, fromInventory: 30);
        var db = MockFor(f);

        await StateEndpoint(db).HandleAsync(StateRequest(f, OutgoingShipmentState.Loaded), CancellationToken.None);
        await StateEndpoint(db).HandleAsync(StateRequest(f, OutgoingShipmentState.Created), CancellationToken.None);
        await StateEndpoint(db).HandleAsync(StateRequest(f, OutgoingShipmentState.Loaded), CancellationToken.None);

        f.Stock.Quantity.Should().Be(10);
    }

    [Fact]
    public async Task SetState_CancellingALoadedRun_ReturnsTheStockBeforeClearingTheSourcing()
    {
        // Order matters: cancelling wipes QuantityFromInventory, which is the very number the
        // return reads. Returning after the wipe would silently return nothing.
        var f = BuildFixture(state: OutgoingShipmentState.Loaded, ordered: 30, stockQuantity: 10, fromInventory: 30);

        await StateEndpoint(MockFor(f)).HandleAsync(StateRequest(f, OutgoingShipmentState.Cancelled), CancellationToken.None);

        f.Stock.Quantity.Should().Be(40);
        f.Item.QuantityFromInventory.Should().Be(0);
        f.Order.State.Should().Be(OrderState.New);
    }

    [Fact]
    public async Task SetState_LoadedToInTransit_LeavesStockAlone()
    {
        // The goods are on the truck either way — the shelf does not change.
        var f = BuildFixture(state: OutgoingShipmentState.Loaded, ordered: 30, stockQuantity: 10, fromInventory: 30);

        await StateEndpoint(MockFor(f)).HandleAsync(StateRequest(f, OutgoingShipmentState.InTransit), CancellationToken.None);

        f.Stock.Quantity.Should().Be(10);
    }

    // -----------------------------------------------------------------------------------
    // The sourcing endpoint.
    // -----------------------------------------------------------------------------------

    [Fact]
    public async Task SetSourcing_RecordsThePiecesAndTheStockEntry()
    {
        var f = BuildFixture(ordered: 20);

        await SourcingEndpoint(MockFor(f)).HandleAsync(SourcingRequest(f, 5), CancellationToken.None);

        f.Item.QuantityFromInventory.Should().Be(5);
        f.Item.InventoryItemId.Should().Be(f.Stock.Id);
        f.Item.Quantity.Should().Be(20, "the client still ordered twenty");
    }

    [Fact]
    public async Task SetSourcing_ToZero_ClearsTheStockEntry()
    {
        var f = BuildFixture(fromInventory: 5);

        await SourcingEndpoint(MockFor(f)).HandleAsync(SourcingRequest(f, 0), CancellationToken.None);

        f.Item.QuantityFromInventory.Should().Be(0);
        f.Item.InventoryItemId.Should().BeNull();
    }

    [Fact]
    public async Task SetSourcing_BeforeLoading_DoesNotTouchStock()
    {
        // Until the truck is packed the draw is a reservation, not a movement.
        var f = BuildFixture(ordered: 30, stockQuantity: 40);

        await SourcingEndpoint(MockFor(f)).HandleAsync(SourcingRequest(f, 30), CancellationToken.None);

        f.Stock.Quantity.Should().Be(40);
    }

    [Fact]
    public async Task SetSourcing_AfterLoading_MovesRealStockByTheDifference()
    {
        // 30 already off the shelf (40 → 10). Cutting the line to 12 puts 18 back.
        var f = BuildFixture(state: OutgoingShipmentState.Loaded, ordered: 30, stockQuantity: 10, fromInventory: 30);

        await SourcingEndpoint(MockFor(f)).HandleAsync(SourcingRequest(f, 12), CancellationToken.None);

        f.Stock.Quantity.Should().Be(28);
        f.Item.QuantityFromInventory.Should().Be(12);
    }

    [Fact]
    public async Task SetSourcing_MoreThanWasOrdered_IsRejected()
    {
        var f = BuildFixture(ordered: 20);

        var act = async () => await SourcingEndpoint(MockFor(f)).HandleAsync(SourcingRequest(f, 21), CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
    }

    [Fact]
    public async Task SetSourcing_MoreThanIsInStock_IsAllowed()
    {
        // Deliberately not an error: a booked delivery may still land before loading.
        var f = BuildFixture(ordered: 20, stockQuantity: 2);

        var act = async () => await SourcingEndpoint(MockFor(f)).HandleAsync(SourcingRequest(f, 10), CancellationToken.None);

        await act.Should().NotThrowAsync();
        f.Item.QuantityFromInventory.Should().Be(10);
    }

    [Fact]
    public async Task SetSourcing_UnknownStockEntry_IsNotFound()
    {
        var f = BuildFixture();

        var act = async () => await SourcingEndpoint(MockFor(f))
            .HandleAsync(SourcingRequest(f, 5, inventoryId: Guid.NewGuid()), CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task SetSourcing_UnknownOrderItem_IsNotFound()
    {
        var f = BuildFixture();
        var request = SourcingRequest(f, 5);
        request.OrderItemId = Guid.NewGuid();

        var act = async () => await SourcingEndpoint(MockFor(f)).HandleAsync(request, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task SetSourcing_OnADeliveredRun_IsRejected()
    {
        var f = BuildFixture(state: OutgoingShipmentState.Delivered);

        var act = async () => await SourcingEndpoint(MockFor(f)).HandleAsync(SourcingRequest(f, 5), CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.BadRequestError);
    }

    // -----------------------------------------------------------------------------------
    // The stock-purchase endpoint — "Do garáže".
    //
    // The opposite direction to sourcing: pieces bought from the brewery for our own shelf,
    // rather than ordered pieces taken off it. Keyed by product, because the nakládka keeps
    // one line per product and the add dialog tops that line up rather than opening a second.
    // -----------------------------------------------------------------------------------

    private static SetStockPurchaseEndpoint StockPurchaseEndpoint(Mock<AleTrack.Infrastructure.Persistence.AleTrackDbContext> db) =>
        EndpointBuilder<SetStockPurchaseRequest, SetStockPurchaseEndpoint>
            .Create(db.Object, DriverScopeMockFactory.Unscoped());

    private static SetStockPurchaseRequest StockPurchaseRequest(Fixture f, Product product, int quantity) => new()
    {
        Id = f.Shipment.PublicId,
        Data = new SetStockPurchaseDto { ProductId = product.PublicId, Quantity = quantity }
    };

    /// <summary>A product the run does not yet buy, plus the db mock that can find it.</summary>
    private static (Product Product, Mock<AleTrack.Infrastructure.Persistence.AleTrackDbContext> Db) WithPurchasableProduct(
        Fixture f, params Product[] alsoKnown)
    {
        var product = ProductBuilder.BuildEntity(name: "Svijanská Desítka");
        product.Id = 71;

        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [f.Client],
            orders: [f.Order],
            outgoingShipments: [f.Shipment],
            inventoryItems: [f.Stock],
            products: [product, .. alsoKnown]);
        db.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        return (product, db);
    }

    [Fact]
    public async Task SetStockPurchase_AddsALineForAProductTheRunDoesNotYetBuy()
    {
        var f = BuildFixture();
        var (product, db) = WithPurchasableProduct(f);

        await StockPurchaseEndpoint(db).HandleAsync(StockPurchaseRequest(f, product, 6), CancellationToken.None);

        var line = f.Shipment.StockPurchases.Should().ContainSingle().Subject;
        line.Product.Should().Be(product);
        line.Quantity.Should().Be(6);
        line.IsShipmentLoadingConfirmed.Should().BeFalse();
    }

    [Fact]
    public async Task SetStockPurchase_SetsTheQuantityOfAnExistingLineRatherThanAddingASecond()
    {
        var f = BuildFixture();
        var (product, db) = WithPurchasableProduct(f);
        f.Shipment.StockPurchases.Add(new OutgoingShipmentStockPurchaseItem
        {
            PublicId = Guid.NewGuid(), Product = product, Quantity = 6
        });

        await StockPurchaseEndpoint(db).HandleAsync(StockPurchaseRequest(f, product, 7), CancellationToken.None);

        f.Shipment.StockPurchases.Should().ContainSingle().Which.Quantity.Should().Be(7);
    }

    [Fact]
    public async Task SetStockPurchase_ToZero_DropsTheLine()
    {
        var f = BuildFixture();
        var (product, db) = WithPurchasableProduct(f);
        f.Shipment.StockPurchases.Add(new OutgoingShipmentStockPurchaseItem
        {
            PublicId = Guid.NewGuid(), Product = product, Quantity = 1
        });

        await StockPurchaseEndpoint(db).HandleAsync(StockPurchaseRequest(f, product, 0), CancellationToken.None);

        f.Shipment.StockPurchases.Should().BeEmpty();
    }

    [Fact]
    public async Task SetStockPurchase_ToZeroForALineThatIsNotThere_IsANoOp()
    {
        var f = BuildFixture();
        var (product, db) = WithPurchasableProduct(f);

        var act = async () => await StockPurchaseEndpoint(db)
            .HandleAsync(StockPurchaseRequest(f, product, 0), CancellationToken.None);

        await act.Should().NotThrowAsync();
        f.Shipment.StockPurchases.Should().BeEmpty();
    }

    [Fact]
    public async Task SetStockPurchase_KeepsTheOtherProductsAlone()
    {
        var f = BuildFixture();
        var other = ProductBuilder.BuildEntity(name: "Svijanský Rytíř");
        other.Id = 72;
        var (product, db) = WithPurchasableProduct(f, other);
        f.Shipment.StockPurchases.Add(new OutgoingShipmentStockPurchaseItem
        {
            PublicId = Guid.NewGuid(), Product = other, Quantity = 4
        });

        await StockPurchaseEndpoint(db).HandleAsync(StockPurchaseRequest(f, product, 2), CancellationToken.None);

        f.Shipment.StockPurchases.Should().HaveCount(2);
        f.Shipment.StockPurchases.Single(p => p.Product == other).Quantity.Should().Be(4);
    }

    [Fact]
    public async Task SetStockPurchase_UnknownProduct_IsNotFound()
    {
        var f = BuildFixture();
        var (_, db) = WithPurchasableProduct(f);
        var unknown = ProductBuilder.BuildEntity();

        var act = async () => await StockPurchaseEndpoint(db)
            .HandleAsync(StockPurchaseRequest(f, unknown, 3), CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task SetStockPurchase_RetiredProduct_IsNotFound()
    {
        var f = BuildFixture();
        var (product, db) = WithPurchasableProduct(f);
        product.IsDeleted = true;

        var act = async () => await StockPurchaseEndpoint(db)
            .HandleAsync(StockPurchaseRequest(f, product, 3), CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    /// <summary>
    /// A purchase is content, not progress: it is a thing on the truck, so it freezes when the
    /// truck is packed. The nakládka's own steppers stay live past that boundary — these do not.
    /// </summary>
    [Theory]
    [InlineData(OutgoingShipmentState.Loaded)]
    [InlineData(OutgoingShipmentState.InTransit)]
    [InlineData(OutgoingShipmentState.Delivered)]
    [InlineData(OutgoingShipmentState.Cancelled)]
    public async Task SetStockPurchase_OnceTheContentIsFrozen_IsRejected(OutgoingShipmentState state)
    {
        var f = BuildFixture(state: state);
        var (product, db) = WithPurchasableProduct(f);

        var act = async () => await StockPurchaseEndpoint(db)
            .HandleAsync(StockPurchaseRequest(f, product, 3), CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.ShipmentContentFrozen);
    }

    [Fact]
    public async Task SetStockPurchase_UnknownShipment_IsNotFound()
    {
        var f = BuildFixture();
        var (product, db) = WithPurchasableProduct(f);
        var request = StockPurchaseRequest(f, product, 3);
        request.Id = Guid.NewGuid();

        var act = async () => await StockPurchaseEndpoint(db).HandleAsync(request, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
}
