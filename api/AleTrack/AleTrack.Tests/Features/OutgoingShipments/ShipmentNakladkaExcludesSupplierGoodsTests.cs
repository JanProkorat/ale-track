using AleTrack.Common.Options;
using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Queries.Detail;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Microsoft.Extensions.Options;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// A supplier-good line on an order must never reach the nakládka.
/// </summary>
/// <remarks>
/// The exclusion is structural rather than a filter: the loading table is built from
/// <see cref="Order.OrderItems"/>, and these lines live in
/// <see cref="Order.SupplierGoodItems"/>. This test exists to keep it that way — the
/// cheap "fix" for wanting them visible would be to fold them into OrderItems, which
/// would silently put them on the truck manifest, into the brewery sections, and into
/// the invoice split.
/// </remarks>
public sealed class ShipmentNakladkaExcludesSupplierGoodsTests
{
    [Fact]
    public async Task ProcessAsync_GetDetail_StopProductsCarryOnlyBreweryProducts()
    {
        var shipmentId = Guid.NewGuid();

        var client = ClientBuilder.BuildEntity(name: "Hospoda A", officialAddress: AddressBuilder.BuildEntity());

        var product = ProductBuilder.BuildEntity(publicId: Guid.NewGuid(), name: "Albrecht 12° Světlý ležák");
        product.Brewery = BreweryBuilder.BuildEntity();

        var supplier = SupplierBuilder.BuildEntity(publicId: Guid.NewGuid(), name: "Linde Gas");
        var good = SupplierBuilder.BuildGood(publicId: Guid.NewGuid(), supplierId: supplier.Id, name: "CO₂ láhev");
        good.Supplier = supplier;

        var order = OrderBuilder.BuildEntity(
            client: client,
            orderItems: [new OrderItem { PublicId = Guid.NewGuid(), Product = product, Quantity = 4 }]);
        order.SupplierGoodItems =
        [
            new OrderSupplierGoodItem { PublicId = Guid.NewGuid(), SupplierGood = good, Quantity = 2 }
        ];

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops: [new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = order }]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client],
            orders: [order],
            outgoingShipments: [shipment],
            suppliers: [supplier],
            supplierGoods: [good]);

        var endpoint = EndpointWithResponseBuilder<GetOutgoingShipmentDetailRequest, OutgoingShipmentDetailDto, GetOutgoingShipmentDetailEndpoint>
            .Create(dbContext.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Unscoped());

        await endpoint.HandleAsync(new GetOutgoingShipmentDetailRequest { Id = shipmentId }, CancellationToken.None);

        var stop = endpoint.Response.Stops.Should().ContainSingle().Subject;

        stop.Products.Should().ContainSingle("only the brewery product belongs on the loading list")
            .Which.Name.Should().Be("Albrecht 12° Světlý ležák");
        stop.Products.Should().NotContain(p => p.Name == "CO₂ láhev");

        // Nor should they leak in through the extras the stop does display: those are the
        // order's free-text CustomExtraItems, a different collection again.
        stop.CustomExtraItems.Should().BeEmpty();
    }
}
