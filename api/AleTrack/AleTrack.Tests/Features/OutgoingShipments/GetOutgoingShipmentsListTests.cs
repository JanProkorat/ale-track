using AleTrack.Common.Models;
using AleTrack.Features.OutgoingShipments.Queries.List;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// The Vývozy list is ordered by creation, newest first — the delivery date is a
/// planning field that moves, so it never decided the list's order.
/// </summary>
public sealed class GetOutgoingShipmentsListTests
{
    [Fact]
    public async Task HandleAsync_ShipmentsList_ReturnsNewestCreatedFirst()
    {
        // Delivery dates deliberately run opposite to creation, so an ordering that
        // fell back to the delivery date would hand them back reversed.
        var oldest = OutgoingShipmentBuilder.BuildEntity(
            name: "Nejstarší",
            createdDate: new DateTime(2026, 7, 1, 8, 0, 0, DateTimeKind.Utc),
            deliveryDate: new DateTime(2026, 8, 20, 8, 0, 0, DateTimeKind.Utc));
        var middle = OutgoingShipmentBuilder.BuildEntity(
            name: "Prostřední",
            createdDate: new DateTime(2026, 7, 15, 8, 0, 0, DateTimeKind.Utc),
            deliveryDate: new DateTime(2026, 8, 10, 8, 0, 0, DateTimeKind.Utc));
        var newest = OutgoingShipmentBuilder.BuildEntity(
            name: "Nejnovější",
            createdDate: new DateTime(2026, 7, 30, 8, 0, 0, DateTimeKind.Utc),
            deliveryDate: new DateTime(2026, 8, 1, 8, 0, 0, DateTimeKind.Utc));

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            outgoingShipments: [middle, oldest, newest]);

        var endpoint = EndpointWithResponseBuilder<FilterableRequest, List<OutgoingShipmentListItemDto>, GetOutgoingShipmentsListEndpoint>
            .Create(dbContext.Object, DriverScopeMockFactory.Unscoped());

        await endpoint.HandleAsync(new FilterableRequest(), CancellationToken.None);

        endpoint.Response.Select(s => s.Name).Should().Equal("Nejnovější", "Prostřední", "Nejstarší");
    }

    [Fact]
    public async Task HandleAsync_ShipmentsListWithExplicitSort_HonoursRequestedOrder()
    {
        var first = OutgoingShipmentBuilder.BuildEntity(
            name: "Alfa",
            createdDate: new DateTime(2026, 7, 1, 8, 0, 0, DateTimeKind.Utc));
        var second = OutgoingShipmentBuilder.BuildEntity(
            name: "Beta",
            createdDate: new DateTime(2026, 7, 30, 8, 0, 0, DateTimeKind.Utc));

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            outgoingShipments: [second, first]);

        var endpoint = EndpointWithResponseBuilder<FilterableRequest, List<OutgoingShipmentListItemDto>, GetOutgoingShipmentsListEndpoint>
            .Create(dbContext.Object, DriverScopeMockFactory.Unscoped());

        var request = new FilterableRequest
        {
            Parameters = new Dictionary<string, string> { ["sort"] = "asc:Name" }
        };

        await endpoint.HandleAsync(request, CancellationToken.None);

        endpoint.Response.Select(s => s.Name).Should().Equal("Alfa", "Beta");
    }
}
