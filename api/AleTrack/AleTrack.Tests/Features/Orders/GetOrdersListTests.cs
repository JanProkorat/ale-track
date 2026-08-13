using AleTrack.Common.Models;
using AleTrack.Features.Orders.Queries.List;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.Orders;

/// <summary>
/// The orders list carries the client's public ID so a caller can narrow it to a
/// single client — the client detail's order tab — instead of matching by name,
/// which two clients can share.
/// </summary>
public sealed class GetOrdersListTests
{
    [Fact]
    public async Task HandleAsync_OrdersList_ProjectsClientPublicId()
    {
        var client = ClientBuilder.BuildEntity(name: "Pivnice U Kotvy");
        var order = OrderBuilder.BuildEntity(client: client);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(orders: [order]);

        var endpoint = EndpointWithResponseBuilder<FilterableRequest, List<OrderListItemDto>, GetOrdersListEndpoint>
            .Create(dbContext.Object);

        await endpoint.HandleAsync(new FilterableRequest(), CancellationToken.None);

        endpoint.Response.Should().ContainSingle()
            .Which.ClientId.Should().Be(client.PublicId);
    }

    [Fact]
    public async Task HandleAsync_FilteredByClientId_ReturnsOnlyThatClientsOrders()
    {
        // Both clients share a name on purpose: a name-based filter would return both.
        var client = ClientBuilder.BuildEntity(name: "Hostinec Na Rychtě");
        var otherClient = ClientBuilder.BuildEntity(name: "Hostinec Na Rychtě");

        var wanted = OrderBuilder.BuildEntity(client: client);
        var alsoWanted = OrderBuilder.BuildEntity(client: client);
        var foreign = OrderBuilder.BuildEntity(client: otherClient);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(orders: [wanted, foreign, alsoWanted]);

        var endpoint = EndpointWithResponseBuilder<FilterableRequest, List<OrderListItemDto>, GetOrdersListEndpoint>
            .Create(dbContext.Object);

        var request = new FilterableRequest
        {
            Parameters = new Dictionary<string, string> { ["clientId"] = $"eq:{client.PublicId}" }
        };

        await endpoint.HandleAsync(request, CancellationToken.None);

        endpoint.Response.Select(o => o.Id).Should().BeEquivalentTo([wanted.PublicId, alsoWanted.PublicId]);
    }
}
