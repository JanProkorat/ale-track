using AleTrack.Entities;
using AleTrack.Features.Orders.Queries.Detail;
using AleTrack.Infrastructure.Persistence;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Orders;

/// <summary>
/// Order detail item pricing: live-resolved against the client's own ceník while an order is
/// still being composed, then frozen to whatever was actually billed once a run has loaded it.
/// </summary>
public sealed class OrderItemPricingTests
{
    [Fact]
    public async Task HandleAsync_OrderNotYetLoaded_ResolvesTheClientPriceLive()
    {
        var f = BuildFixture(overridePrice: 1190m, snapshotPrice: null);
        var dbContext = MockFor(f);

        var endpoint = EndpointWithResponseBuilder<GetOrderDetailRequest, OrderDto, GetOrderDetailEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new GetOrderDetailRequest { Id = f.Order.PublicId }, CancellationToken.None);

        var item = endpoint.Response.OrderItems.Should().ContainSingle().Subject;
        item.UnitPriceWithVat.Should().Be(1190m);
        item.ListPriceWithVat.Should().Be(1290m);
    }

    [Fact]
    public async Task HandleAsync_OrderAlreadyLoaded_ReadsTheFrozenSnapshotAndReportsNoListPrice()
    {
        // The snapshot (1150) deliberately differs from what live resolution would produce
        // (1190) — proving the endpoint reads the frozen row rather than happening to agree.
        var f = BuildFixture(overridePrice: 1190m, snapshotPrice: 1150m);
        var dbContext = MockFor(f);

        var endpoint = EndpointWithResponseBuilder<GetOrderDetailRequest, OrderDto, GetOrderDetailEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new GetOrderDetailRequest { Id = f.Order.PublicId }, CancellationToken.None);

        var item = endpoint.Response.OrderItems.Should().ContainSingle().Subject;
        item.UnitPriceWithVat.Should().Be(1150m);
        item.ListPriceWithVat.Should().BeNull();
    }

    [Fact]
    public async Task HandleAsync_ClientWithoutOwnPrice_ResolvesCatalogPriceWithNoListPrice()
    {
        var f = BuildFixture(overridePrice: null, snapshotPrice: null);
        var dbContext = MockFor(f);

        var endpoint = EndpointWithResponseBuilder<GetOrderDetailRequest, OrderDto, GetOrderDetailEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new GetOrderDetailRequest { Id = f.Order.PublicId }, CancellationToken.None);

        var item = endpoint.Response.OrderItems.Should().ContainSingle().Subject;
        item.UnitPriceWithVat.Should().Be(1290m);
        item.ListPriceWithVat.Should().BeNull();
    }

    private sealed record Fixture(
        Order Order,
        Client Client,
        Product Product,
        OrderItem Item,
        ClientProductPrice? ClientPrice,
        OutgoingShipmentStopItem? StopItem);

    private static Fixture BuildFixture(decimal? overridePrice, decimal? snapshotPrice)
    {
        var client = ClientBuilder.BuildEntity(publicId: Guid.NewGuid(), officialAddress: AddressBuilder.BuildEntity());
        client.Id = 1;

        var brewery = BreweryBuilder.BuildEntity(publicId: Guid.NewGuid(), officialAddress: AddressBuilder.BuildEntity());
        brewery.Id = 1;

        var product = ProductBuilder.BuildEntity(publicId: Guid.NewGuid(), name: "Albrecht 12°", priceWithVat: 1290m);
        product.Id = 41;
        product.Brewery = brewery;

        var item = new OrderItem
        {
            Id = 51,
            PublicId = Guid.NewGuid(),
            Product = product,
            ProductId = product.Id,
            Quantity = 6
        };

        var order = OrderBuilder.BuildEntity(publicId: Guid.NewGuid(), client: client, orderItems: [item]);
        // The main projection reads i.Order.PublicId, so the back-reference has to be there.
        item.Order = order;

        var clientPrice = overridePrice is null
            ? null
            : new ClientProductPrice
            {
                PublicId = Guid.NewGuid(),
                Client = client,
                ClientId = client.Id,
                Product = product,
                ProductId = product.Id,
                PriceWithVat = overridePrice.Value,
                SetOn = DateOnly.FromDateTime(DateTime.UtcNow)
            };

        var stopItem = snapshotPrice is null
            ? null
            : new OutgoingShipmentStopItem
            {
                PublicId = Guid.NewGuid(),
                OrderItemId = item.Id,
                UnitPriceWithVat = snapshotPrice.Value
            };

        return new Fixture(order, client, product, item, clientPrice, stopItem);
    }

    private static Mock<AleTrackDbContext> MockFor(Fixture fixture) => AleTrackDbContextMockFactory.CreateMock(
        clients: [fixture.Client],
        products: [fixture.Product],
        orders: [fixture.Order],
        orderItems: [fixture.Item],
        clientProductPrices: fixture.ClientPrice is null ? [] : [fixture.ClientPrice],
        outgoingShipmentStopItems: fixture.StopItem is null ? [] : [fixture.StopItem]);
}
