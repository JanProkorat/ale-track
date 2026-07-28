using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Entities;
using AleTrack.Features.Breweries.Queries.ProductList;
using AleTrack.Features.OutgoingShipments.Commands.SetLoadingState;
using AleTrack.Features.Products.Queries.List;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.Products;

/// <summary>
/// A retired product must vanish from every surface a user picks from, and stay
/// resolvable everywhere history already references it.
/// </summary>
/// <remarks>
/// The split is the rule: filter where a user <em>picks</em> a product, never where the
/// system <em>resolves</em> one that history already points at. Product deliberately has
/// no global query filter, so both halves have to be tested — nothing enforces them.
/// </remarks>
public sealed class RetiredProductVisibilityTests
{
    [Fact]
    public async Task HandleAsync_ProductsList_ExcludesRetiredProduct()
    {
        var brewery = BreweryBuilder.BuildEntity();
        var live = ProductBuilder.BuildEntity(publicId: Guid.NewGuid(), name: "Live");
        live.Brewery = brewery;
        var retired = ProductBuilder.BuildEntity(publicId: Guid.NewGuid(), name: "Retired");
        retired.Brewery = brewery;
        retired.IsDeleted = true;

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            breweries: [brewery],
            products: [live, retired]);

        var endpoint = EndpointWithResponseBuilder<FilterableRequest, List<ProductListItemDto>, GetProductsListEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new FilterableRequest(), CancellationToken.None);

        endpoint.Response.Should().HaveCount(1);
        endpoint.Response.Single().Id.Should().Be(live.PublicId);
    }

    [Fact]
    public async Task HandleAsync_BreweryProductsList_ExcludesRetiredProduct()
    {
        var brewery = BreweryBuilder.BuildEntity(publicId: Guid.NewGuid());
        var live = ProductBuilder.BuildEntity(publicId: Guid.NewGuid(), name: "Live");
        live.Brewery = brewery;
        var retired = ProductBuilder.BuildEntity(publicId: Guid.NewGuid(), name: "Retired");
        retired.Brewery = brewery;
        retired.IsDeleted = true;

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            breweries: [brewery],
            products: [live, retired]);

        var endpoint = EndpointWithResponseBuilder<GetProductsListRequest, List<BreweryProductListItemDto>, GetBreweryProductsListEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new GetProductsListRequest { Id = brewery.PublicId }, CancellationToken.None);

        endpoint.Response.Should().HaveCount(1);
        endpoint.Response.Single().Id.Should().Be(live.PublicId);
    }

    /// <summary>
    /// The other half of the rule: a run already carrying a since-retired product must
    /// still be loadable. Filtering here would 404 the nakládka for that product.
    /// </summary>
    [Fact]
    public async Task HandleAsync_SetLoadingState_StillResolvesRetiredProduct()
    {
        var brewery = BreweryBuilder.BuildEntity();
        var retired = ProductBuilder.BuildEntity(publicId: Guid.NewGuid(), name: "Retired");
        retired.Id = 1;
        retired.Brewery = brewery;
        retired.IsDeleted = true;

        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(publicId: Guid.NewGuid(), client: client);
        order.OrderItems =
        [
            new OrderItem { PublicId = Guid.NewGuid(), Product = retired, ProductId = retired.Id, Quantity = 4 }
        ];

        var shipmentId = Guid.NewGuid();
        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            state: OutgoingShipmentState.Created);
        shipment.Stops =
        [
            new OutgoingShipmentStop
            {
                PublicId = Guid.NewGuid(),
                Kind = OutgoingShipmentStopKind.Order,
                Order = 1,
                ClientOrder = order
            }
        ];

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            breweries: [brewery],
            products: [retired],
            clients: [client],
            orders: [order],
            outgoingShipments: [shipment]);

        var endpoint = EndpointBuilder<SetLoadingStateRequest, SetLoadingStateEndpoint>.Create(dbContext.Object);

        var act = async () => await endpoint.HandleAsync(new SetLoadingStateRequest
        {
            Id = shipmentId,
            Data = new SetLoadingStateDto
            {
                ProductId = retired.PublicId,
                Sequence = 1,
                State = ShipmentLoadingState.Dictated
            }
        }, CancellationToken.None);

        // Must not fail with "product not found" — the product resolves despite being retired.
        await act.Should().NotThrowAsync();
    }
}
