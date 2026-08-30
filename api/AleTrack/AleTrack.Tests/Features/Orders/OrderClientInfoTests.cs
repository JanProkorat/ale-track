using AleTrack.Features.Orders.Queries.Detail;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.Orders;

/// <summary>
/// The order detail names the client both ways, because the header links both: the name on the
/// door and the company invoiced for it.
/// </summary>
public sealed class OrderClientInfoTests
{
    [Fact]
    public async Task ProcessAsync_ClientHasBusinessName_ProjectsBothNames()
    {
        var orderId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(
            name: "Drak Zittau",
            businessName: "DLR Gastro Event UG",
            officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(publicId: orderId, client: client);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client], orders: [order]);

        var endpoint = EndpointWithResponseBuilder<GetOrderDetailRequest, OrderDto, GetOrderDetailEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new GetOrderDetailRequest { Id = orderId }, CancellationToken.None);

        endpoint.Response.Client.Id.Should().Be(client.PublicId);
        endpoint.Response.Client.Name.Should().Be("Drak Zittau");
        endpoint.Response.Client.BusinessName.Should().Be("DLR Gastro Event UG");
    }

    [Fact]
    public async Task ProcessAsync_ClientHasNoBusinessName_ProjectsNameOnly()
    {
        var orderId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(name: "Drak Zittau", officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(publicId: orderId, client: client);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client], orders: [order]);

        var endpoint = EndpointWithResponseBuilder<GetOrderDetailRequest, OrderDto, GetOrderDetailEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new GetOrderDetailRequest { Id = orderId }, CancellationToken.None);

        endpoint.Response.Client.BusinessName.Should().BeNull();
    }
}
