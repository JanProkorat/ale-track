using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Options;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Commands.SetSupplierGoodSourcing;
using AleTrack.Infrastructure.Persistence;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Moq;
using static AleTrack.Tests.Features.OutgoingShipments.OutgoingShipmentTestHelpers;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// Moving a supplier good's pieces between the garage and the supplier, one click at a time.
/// The split is what the route is derived from, so this endpoint re-derives the pickup stops
/// rather than only writing a number — that is the whole reason it is not a plain field write.
/// </summary>
public sealed class SetSupplierGoodSourcingTests
{
    [Fact]
    public async Task HandleAsync_MoveEveryPieceToTheGarage_DropsTheSupplierStopAndAddsTheCompanyStop()
    {
        var f = Arrange(fromGarage: 0, quantity: 3, state: OutgoingShipmentState.Created);

        await Act(f, quantityFromGarage: 3);

        f.Line.QuantityFromGarage.Should().Be(3);
        f.Shipment.Stops.Should().NotContain(s => s.Kind == OutgoingShipmentStopKind.Supplier);
        f.Shipment.Stops.Should().ContainSingle(s => s.Kind == OutgoingShipmentStopKind.Company);
        f.DbContext.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_MoveEveryPieceToTheSupplier_DropsTheCompanyStopAndAddsTheSupplierStop()
    {
        var f = Arrange(fromGarage: 3, quantity: 3, state: OutgoingShipmentState.Created);

        await Act(f, quantityFromGarage: 0);

        f.Line.QuantityFromGarage.Should().Be(0);
        f.Shipment.Stops.Should().ContainSingle(s => s.Kind == OutgoingShipmentStopKind.Supplier);
        f.Shipment.Stops.Should().NotContain(s => s.Kind == OutgoingShipmentStopKind.Company);
    }

    /// <summary>A part-split needs both stops, because both are being called at.</summary>
    [Fact]
    public async Task HandleAsync_SplitTheLine_KeepsBothStops()
    {
        var f = Arrange(fromGarage: 0, quantity: 4, state: OutgoingShipmentState.Created);

        await Act(f, quantityFromGarage: 1);

        f.Shipment.Stops.Should().ContainSingle(s => s.Kind == OutgoingShipmentStopKind.Supplier);
        f.Shipment.Stops.Should().ContainSingle(s => s.Kind == OutgoingShipmentStopKind.Company);
    }

    /// <summary>
    /// Stock purchases are the company stop's other reason to exist, so emptying the garage
    /// side of every good must not take it away from them.
    /// </summary>
    [Fact]
    public async Task HandleAsync_MoveAllToSupplierWithStockPurchases_KeepsTheCompanyStop()
    {
        var f = Arrange(fromGarage: 2, quantity: 2, state: OutgoingShipmentState.Created);
        f.Shipment.StockPurchases.Add(new OutgoingShipmentStockPurchaseItem
        {
            PublicId = Guid.NewGuid(),
            Product = ProductBuilder.BuildEntity(),
            Quantity = 6
        });

        await Act(f, quantityFromGarage: 0);

        f.Shipment.Stops.Should().ContainSingle(s => s.Kind == OutgoingShipmentStopKind.Company);
    }

    [Fact]
    public async Task HandleAsync_MoreThanOrdered_IsRejected()
    {
        var f = Arrange(fromGarage: 0, quantity: 2, state: OutgoingShipmentState.Created);

        var act = async () => await Act(f, quantityFromGarage: 3);

        await act.Should().ThrowAsync<AleTrackException>();
        f.Line.QuantityFromGarage.Should().Be(0);
    }

    [Fact]
    public async Task HandleAsync_UnknownLine_ReportsNotFound()
    {
        var f = Arrange(fromGarage: 0, quantity: 2, state: OutgoingShipmentState.Created);

        var endpoint = EndpointBuilder<SetSupplierGoodSourcingRequest, SetSupplierGoodSourcingEndpoint>
            .Create(f.DbContext.Object, DriverScopeMockFactory.Unscoped(), Options.Create(Company));

        var act = async () => await endpoint.HandleAsync(
            new SetSupplierGoodSourcingRequest
            {
                Id = f.Shipment.PublicId,
                ItemId = Guid.NewGuid(),
                Data = new SetSupplierGoodSourcingDto { QuantityFromGarage = 1 }
            },
            CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    /// <summary>
    /// Before the truck is packed the draw is only a reservation, so the shelf must not move.
    /// </summary>
    [Fact]
    public async Task HandleAsync_WhileStillCreated_DoesNotTouchStock()
    {
        var f = Arrange(fromGarage: 0, quantity: 3, state: OutgoingShipmentState.Created);
        var before = f.Stock.Quantity;

        await Act(f, quantityFromGarage: 3);

        f.Stock.Quantity.Should().Be(before);
    }

    /// <summary>
    /// Past Loaded the pieces are already off the shelf, so a change of mind has to move real
    /// stock: give back what the line held, take what it now holds.
    /// </summary>
    [Fact]
    public async Task HandleAsync_OnALoadedRun_MovesRealStock()
    {
        var f = Arrange(fromGarage: 2, quantity: 5, state: OutgoingShipmentState.Loaded);
        f.Stock.Quantity = 10;

        await Act(f, quantityFromGarage: 5);

        // 10 + the 2 it held back, less the 5 it now holds.
        f.Stock.Quantity.Should().Be(7);
    }

    [Fact]
    public async Task HandleAsync_OnALoadedRunReducingTheDraw_PutsStockBack()
    {
        var f = Arrange(fromGarage: 4, quantity: 4, state: OutgoingShipmentState.Loaded);
        f.Stock.Quantity = 6;

        await Act(f, quantityFromGarage: 1);

        // 6 + 4 returned - 1 taken.
        f.Stock.Quantity.Should().Be(9);
    }

    [Fact]
    public async Task HandleAsync_OnADeliveredRun_IsRejected()
    {
        var f = Arrange(fromGarage: 0, quantity: 2, state: OutgoingShipmentState.Delivered);

        var act = async () => await Act(f, quantityFromGarage: 1);

        await act.Should().ThrowAsync<AleTrackException>();
    }

    private sealed record Fixture(
        OutgoingShipment Shipment,
        OrderSupplierGoodItem Line,
        InventoryItem Stock,
        Mock<AleTrackDbContext> DbContext);

    private static Fixture Arrange(int fromGarage, int quantity, OutgoingShipmentState state)
    {
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(publicId: Guid.NewGuid(), client: client);

        var supplier = SupplierBuilder.BuildEntity(
            publicId: Guid.NewGuid(), id: 1, name: "Linde Gas",
            officialAddress: AddressBuilder.BuildEntity(latitude: 50.77m, longitude: 15.05m));

        var good = SupplierBuilder.BuildGood(publicId: Guid.NewGuid(), id: 10, supplierId: supplier.Id);
        good.Supplier = supplier;

        var stock = new InventoryItem { Id = 77, PublicId = Guid.NewGuid(), Quantity = 12, SupplierGood = good };
        good.InventoryItem = stock;

        var line = new OrderSupplierGoodItem
        {
            PublicId = Guid.NewGuid(),
            SupplierGood = good,
            Quantity = quantity,
            QuantityFromGarage = fromGarage
        };
        order.SupplierGoodItems = [line];

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: Guid.NewGuid(),
            state: state,
            stops: [new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = order }]);

        // The stops the run would already carry for this split, as the reconcilers would have
        // left them — so each test starts from a consistent route rather than an empty one.
        if (fromGarage < quantity)
        {
            shipment.Stops.Add(new OutgoingShipmentStop
            {
                Order = 2, Kind = OutgoingShipmentStopKind.Supplier,
                Supplier = supplier, SupplierId = supplier.Id, Label = supplier.Name
            });
        }

        if (fromGarage > 0)
        {
            shipment.Stops.Add(new OutgoingShipmentStop
            {
                Order = 3, Kind = OutgoingShipmentStopKind.Company, Label = Company.Name
            });
        }

        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [client],
            orders: [order],
            outgoingShipments: [shipment],
            suppliers: [supplier],
            supplierGoods: [good],
            inventoryItems: [stock]);
        db.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        return new Fixture(shipment, line, stock, db);
    }

    private static async Task Act(Fixture f, int quantityFromGarage)
    {
        var endpoint = EndpointBuilder<SetSupplierGoodSourcingRequest, SetSupplierGoodSourcingEndpoint>
            .Create(f.DbContext.Object, DriverScopeMockFactory.Unscoped(), Options.Create(Company));

        await endpoint.HandleAsync(
            new SetSupplierGoodSourcingRequest
            {
                Id = f.Shipment.PublicId,
                ItemId = f.Line.PublicId,
                Data = new SetSupplierGoodSourcingDto { QuantityFromGarage = quantityFromGarage }
            },
            CancellationToken.None);
    }
}
