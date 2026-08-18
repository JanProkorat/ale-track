using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using AleTrack.Features.ProductDeliveries.Commands.Update;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.ProductDeliveries;

/// <summary>
/// What finishing a dovoz does to the warehouse.
/// </summary>
public sealed class DeliveryStockingTests
{
    private const long SupplierEntityId = 7;

    private sealed record Fixture(
        Mock<AleTrackDbContext> DbContext,
        Guid DeliveryId,
        Guid StopId,
        Guid SupplierId,
        Guid GoodId,
        SupplierGood Good,
        ProductDelivery Delivery);

    /// <summary>
    /// A dovoz with one supplier stop, in whichever state the caller needs, plus whatever stock rows
    /// already exist.
    /// </summary>
    private static Fixture BuildSupplierDelivery(
        ProductDeliveryState state = ProductDeliveryState.OnTheWay,
        List<InventoryItem>? inventoryItems = null,
        List<SupplierGoodPrice>? prices = null)
    {
        var supplierId = Guid.NewGuid();
        var goodId = Guid.NewGuid();
        var supplier = SupplierBuilder.BuildEntity(publicId: supplierId, id: SupplierEntityId);
        var good = SupplierBuilder.BuildGood(
            publicId: goodId,
            id: 3,
            supplierId: SupplierEntityId,
            prices: prices ??
            [
                SupplierBuilder.BuildPrice(SupplierChargeKind.Fill, 640m),
                SupplierBuilder.BuildPrice(SupplierChargeKind.Purchase, 4200m),
                SupplierBuilder.BuildPrice(SupplierChargeKind.Deposit, 1500m),
                SupplierBuilder.BuildPrice(SupplierChargeKind.Rent, 90m),
                SupplierBuilder.BuildPrice(SupplierChargeKind.Other, 10m)
            ]);

        var stopId = Guid.NewGuid();
        var delivery = ProductDeliveryBuilder.BuildEntity(
            state: state,
            stops: [ProductDeliveryBuilder.BuildSupplierStopEntity(publicId: stopId, supplier: supplier)]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            productDeliveries: [delivery],
            suppliers: [supplier],
            supplierGoods: [good],
            inventoryItems: inventoryItems ?? []);

        return new Fixture(dbContext, delivery.PublicId, stopId, supplierId, goodId, good, delivery);
    }

    private static UpdateProductDeliveryRequest Finish(Fixture f, params UpdateProductDeliveryItemDto[] lines)
        => new()
        {
            Id = f.DeliveryId,
            Data = ProductDeliveryBuilder.BuildUpdateDto(
                state: ProductDeliveryState.Finished,
                stops:
                [
                    ProductDeliveryBuilder.BuildUpdateSupplierStopDto(
                        publicId: f.StopId,
                        supplierId: f.SupplierId,
                        products: lines.ToList())
                ])
        };

    private static async Task HandleAsync(Fixture f, UpdateProductDeliveryRequest request)
    {
        var endpoint = EndpointBuilder<UpdateProductDeliveryRequest, UpdateProductDeliveryEndpoint>.Create(f.DbContext.Object);
        await endpoint.HandleAsync(request, CancellationToken.None);
    }

    [Fact]
    public async Task Finishing_StocksAGoodThatHasNoRowYet()
    {
        var f = BuildSupplierDelivery();

        await HandleAsync(f, Finish(f, ProductDeliveryBuilder.BuildUpdateGoodItemDto(
            supplierGoodId: f.GoodId, chargeKind: SupplierChargeKind.Fill, quantity: 2)));

        f.DbContext.Verify(e => e.InventoryItems.AddRange(It.Is<IEnumerable<InventoryItem>>(items =>
            items.Count() == 1
            && items.Single().SupplierGood == f.Good
            && items.Single().Product == null
            && items.Single().Quantity == 2)), Times.Once);
    }

    [Fact]
    public async Task Finishing_IncrementsTheGoodsExistingRow()
    {
        var existing = new InventoryItem { PublicId = Guid.NewGuid(), Quantity = 5 };
        var f = BuildSupplierDelivery(inventoryItems: [existing]);
        existing.SupplierGood = f.Good;

        await HandleAsync(f, Finish(f, ProductDeliveryBuilder.BuildUpdateGoodItemDto(
            supplierGoodId: f.GoodId, chargeKind: SupplierChargeKind.Fill, quantity: 3)));

        existing.Quantity.Should().Be(8);
        f.DbContext.Verify(e => e.InventoryItems.AddRange(It.IsAny<IEnumerable<InventoryItem>>()), Times.Never);
    }

    /// <summary>
    /// A stock row counts a full bottle, and every charge kind on a supplier stop reaches it — the
    /// recorded decision, deposit and rent lines included.
    /// </summary>
    [Fact]
    public async Task Finishing_StocksEveryChargeKind()
    {
        var f = BuildSupplierDelivery();

        await HandleAsync(f, Finish(f,
            ProductDeliveryBuilder.BuildUpdateGoodItemDto(supplierGoodId: f.GoodId, chargeKind: SupplierChargeKind.Fill, quantity: 1),
            ProductDeliveryBuilder.BuildUpdateGoodItemDto(supplierGoodId: f.GoodId, chargeKind: SupplierChargeKind.Purchase, quantity: 1),
            ProductDeliveryBuilder.BuildUpdateGoodItemDto(supplierGoodId: f.GoodId, chargeKind: SupplierChargeKind.Deposit, quantity: 1),
            ProductDeliveryBuilder.BuildUpdateGoodItemDto(supplierGoodId: f.GoodId, chargeKind: SupplierChargeKind.Rent, quantity: 1),
            ProductDeliveryBuilder.BuildUpdateGoodItemDto(supplierGoodId: f.GoodId, chargeKind: SupplierChargeKind.Other, quantity: 1)));

        f.DbContext.Verify(e => e.InventoryItems.AddRange(It.Is<IEnumerable<InventoryItem>>(items =>
            items.Count() == 1 && items.Single().Quantity == 5)), Times.Once);
    }

    /// <summary>
    /// The same bottle refilled and bought is two delivery lines at two prices but one thing on the
    /// shelf. Looking only at stored rows would create a second row for the second line.
    /// </summary>
    [Fact]
    public async Task Finishing_MergesTwoChargeKindsOfOneGoodIntoOneRow()
    {
        var f = BuildSupplierDelivery();

        await HandleAsync(f, Finish(f,
            ProductDeliveryBuilder.BuildUpdateGoodItemDto(supplierGoodId: f.GoodId, chargeKind: SupplierChargeKind.Fill, quantity: 2),
            ProductDeliveryBuilder.BuildUpdateGoodItemDto(supplierGoodId: f.GoodId, chargeKind: SupplierChargeKind.Purchase, quantity: 1)));

        f.DbContext.Verify(e => e.InventoryItems.AddRange(It.Is<IEnumerable<InventoryItem>>(items =>
            items.Count() == 1
            && items.Single().SupplierGood == f.Good
            && items.Single().Quantity == 3)), Times.Once);
    }

    /// <summary>
    /// Stock is booked in on the way into Finished, not on being Finished. Correcting a finished
    /// dovoz's note is legitimate, and the old rule stocked the whole delivery again each time.
    /// </summary>
    [Fact]
    public async Task Finishing_AnAlreadyFinishedDelivery_StocksNothingASecondTime()
    {
        var existing = new InventoryItem { PublicId = Guid.NewGuid(), Quantity = 5 };
        var f = BuildSupplierDelivery(state: ProductDeliveryState.Finished, inventoryItems: [existing]);
        existing.SupplierGood = f.Good;

        await HandleAsync(f, Finish(f, ProductDeliveryBuilder.BuildUpdateGoodItemDto(
            supplierGoodId: f.GoodId, chargeKind: SupplierChargeKind.Fill, quantity: 3)));

        existing.Quantity.Should().Be(5);
        f.DbContext.Verify(e => e.InventoryItems.AddRange(It.IsAny<IEnumerable<InventoryItem>>()), Times.Never);
    }

    /// <summary>
    /// The same guard has to hold for the beer, which is the half that has been double-counting all
    /// along.
    /// </summary>
    [Fact]
    public async Task Finishing_AnAlreadyFinishedDelivery_DoesNotRestockProductsEither()
    {
        var breweryId = Guid.NewGuid();
        var productId = Guid.NewGuid();
        var stopId = Guid.NewGuid();

        var brewery = BreweryBuilder.BuildEntity(publicId: breweryId);
        var product = ProductBuilder.BuildEntity(publicId: productId);
        product.Id = 42;
        var existing = new InventoryItem { PublicId = Guid.NewGuid(), Quantity = 10, Product = product };

        var delivery = ProductDeliveryBuilder.BuildEntity(
            state: ProductDeliveryState.Finished,
            stops: [ProductDeliveryBuilder.BuildDeliveryStopEntity(publicId: stopId, brewery: brewery)]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            productDeliveries: [delivery],
            breweries: [brewery],
            products: [product],
            inventoryItems: [existing]);

        var command = new UpdateProductDeliveryRequest
        {
            Id = delivery.PublicId,
            Data = ProductDeliveryBuilder.BuildUpdateDto(
                state: ProductDeliveryState.Finished,
                stops:
                [
                    ProductDeliveryBuilder.BuildUpdateStopDto(
                        publicId: stopId,
                        breweryId: breweryId,
                        products: [ProductDeliveryBuilder.BuildUpdateItemDto(productId: productId, quantity: 6)])
                ])
        };

        var endpoint = EndpointBuilder<UpdateProductDeliveryRequest, UpdateProductDeliveryEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        existing.Quantity.Should().Be(10);
    }

    /// <summary>
    /// The transition itself must still stock, or the guard above would have turned the feature off.
    /// </summary>
    [Fact]
    public async Task Finishing_FromOnTheWay_StillStocks()
    {
        var f = BuildSupplierDelivery(state: ProductDeliveryState.OnTheWay);

        await HandleAsync(f, Finish(f, ProductDeliveryBuilder.BuildUpdateGoodItemDto(
            supplierGoodId: f.GoodId, chargeKind: SupplierChargeKind.Fill, quantity: 1)));

        f.DbContext.Verify(e => e.InventoryItems.AddRange(It.IsAny<IEnumerable<InventoryItem>>()), Times.Once);
    }

    [Fact]
    public async Task Saving_ADeliveryStillInPlanning_StocksNothing()
    {
        var f = BuildSupplierDelivery();

        var request = new UpdateProductDeliveryRequest
        {
            Id = f.DeliveryId,
            Data = ProductDeliveryBuilder.BuildUpdateDto(
                state: ProductDeliveryState.InPlanning,
                stops:
                [
                    ProductDeliveryBuilder.BuildUpdateSupplierStopDto(
                        publicId: f.StopId,
                        supplierId: f.SupplierId,
                        products: [ProductDeliveryBuilder.BuildUpdateGoodItemDto(supplierGoodId: f.GoodId)])
                ])
        };

        await HandleAsync(f, request);

        f.DbContext.Verify(e => e.InventoryItems.AddRange(It.IsAny<IEnumerable<InventoryItem>>()), Times.Never);
    }
}
