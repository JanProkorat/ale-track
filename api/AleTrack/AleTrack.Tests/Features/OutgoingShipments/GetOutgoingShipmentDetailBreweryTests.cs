using AleTrack.Common.Enums;
using AleTrack.Common.Options;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Queries.Detail;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Microsoft.Extensions.Options;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// Every product line of the shipment detail names its brewery. The nakládka sections its rows
/// by brewery and aggregates across the whole route, so it cannot recover the supplier from the
/// stop the line happened to arrive on.
/// </summary>
public sealed class GetOutgoingShipmentDetailBreweryTests
{
    [Fact]
    public async Task ProcessAsync_GetDetail_ProjectsBreweryOntoOrderItemsAndStockPurchases()
    {
        var shipmentId = Guid.NewGuid();

        var frydlant = BreweryBuilder.BuildEntity(name: "Pivovar Frýdlant", displayOrder: 1);
        var svijany = BreweryBuilder.BuildEntity(name: "Pivovar Svijany", displayOrder: 2);

        var kegFrydlant = ProductWithBrewery("Albrecht 12°", ProductKind.Keg, packageSize: 30, brewery: frydlant);
        var crateSvijany = ProductWithBrewery("Vozka 11°", ProductKind.Bottle, packageSize: 0.5, brewery: svijany);
        var stockPurchased = ProductWithBrewery("Kněžna 13°", ProductKind.Keg, packageSize: 50, brewery: svijany);

        var client = ClientBuilder.BuildEntity(name: "Hospoda A", officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(
            client: client,
            orderItems:
            [
                new OrderItem { PublicId = Guid.NewGuid(), Quantity = 6, Product = kegFrydlant },
                new OrderItem { PublicId = Guid.NewGuid(), Quantity = 4, Product = crateSvijany }
            ]);

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            stops: [new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, ClientOrder = order }]);

        shipment.StockPurchases.Add(new OutgoingShipmentStockPurchaseItem
        {
            PublicId = Guid.NewGuid(), Quantity = 2, Product = stockPurchased
        });

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client],
            orders: [order],
            outgoingShipments: [shipment]);

        var endpoint = EndpointWithResponseBuilder<GetOutgoingShipmentDetailRequest, OutgoingShipmentDetailDto, GetOutgoingShipmentDetailEndpoint>
            .Create(dbContext.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Unscoped());

        await endpoint.HandleAsync(new GetOutgoingShipmentDetailRequest { Id = shipmentId }, CancellationToken.None);

        var products = endpoint.Response.Stops.Single().Products;
        var keg = products.Single(p => p.Name == "Albrecht 12°");
        keg.BreweryId.Should().Be(frydlant.PublicId);
        keg.BreweryName.Should().Be("Pivovar Frýdlant");
        keg.BreweryDisplayOrder.Should().Be(1);

        var crate = products.Single(p => p.Name == "Vozka 11°");
        crate.BreweryId.Should().Be(svijany.PublicId);
        crate.BreweryName.Should().Be("Pivovar Svijany");
        crate.BreweryDisplayOrder.Should().Be(2);

        // "Zboží na sklad" is bought from a brewery too, and lands in the same sections.
        var purchase = endpoint.Response.StockPurchases.Single();
        purchase.BreweryId.Should().Be(svijany.PublicId);
        purchase.BreweryName.Should().Be("Pivovar Svijany");
        purchase.BreweryDisplayOrder.Should().Be(2);
    }

    private static Product ProductWithBrewery(string name, ProductKind kind, double packageSize, Brewery brewery)
    {
        var product = ProductBuilder.BuildEntity(name: name, kind: kind, packageSize: packageSize);
        product.Brewery = brewery;
        return product;
    }
}
