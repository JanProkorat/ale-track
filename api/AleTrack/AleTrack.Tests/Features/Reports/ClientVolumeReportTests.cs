using AleTrack.Common.Enums;
using AleTrack.Features.Products.Utils;
using AleTrack.Features.Reports.Queries.ClientVolume;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.Reports;

public sealed class GetClientVolumeEndpointTests
{
    private static GetClientVolumeRequest Window() => new()
    {
        From = new DateOnly(2026, 7, 1),
        To = new DateOnly(2026, 7, 31)
    };

    [Fact]
    public async Task HandleAsync_AggregatesPerClientAndRegion()
    {
        // Arrange — one client in ZittauCity, two lines on one delivered stop.
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Delivered,
            region: Region.ZittauCity,
            lines:
            [
                new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 2),
                new(ProductKind.Can, ProductType.Radler, CanSize.ZeroPointFiveLiters, quantity: 10)
            ]);

        var endpoint = EndpointWithResponseBuilder<GetClientVolumeRequest,
            ClientVolumeReportDto, GetClientVolumeEndpoint>.Create(fixture.DbContext.Object);

        // Act
        await endpoint.HandleAsync(Window(), CancellationToken.None);

        // Assert
        var response = endpoint.Response;
        response.Should().NotBeNull();
        response.ClientsServed.Should().Be(1);
        response.TotalWeightKg.Should().Be(129m);

        // Two lines on ONE stop is one delivery, not two.
        response.TotalDeliveries.Should().Be(1);

        response.TopClients.Should().HaveCount(1);
        var row = response.TopClients[0];
        row.ClientId.Should().Be(fixture.Client.PublicId);
        row.ClientName.Should().Be("Hospoda U Kotvy");
        row.Region.Should().Be(Region.ZittauCity);
        row.Deliveries.Should().Be(1);
        row.Units.Should().Be(12);
        row.WeightKg.Should().Be(129m);

        response.ByRegion.Should().HaveCount(1);
        response.ByRegion[0].Region.Should().Be(Region.ZittauCity);
        response.ByRegion[0].WeightKg.Should().Be(129m);
    }

    [Fact]
    public async Task HandleAsync_OrdersTopClientsByWeightDescending()
    {
        // Arrange — two clients, the second heavier, both on delivered stops.
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Delivered,
            lines: [new(ProductKind.Can, ProductType.Radler, CanSize.ZeroPointFiveLiters, quantity: 10)]);

        var heavier = DeliveredShipmentBuilder.AddSecondClient(
            fixture,
            clientName: "Restaurace Na Rynku",
            region: Region.Leipzig,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 3)]);

        var endpoint = EndpointWithResponseBuilder<GetClientVolumeRequest,
            ClientVolumeReportDto, GetClientVolumeEndpoint>.Create(heavier.DbContext.Object);

        // Act
        await endpoint.HandleAsync(Window(), CancellationToken.None);

        // Assert
        var response = endpoint.Response;
        response.ClientsServed.Should().Be(2);
        response.TotalDeliveries.Should().Be(2);
        response.TopClients.Should().HaveCount(2);
        response.TopClients[0].ClientName.Should().Be("Restaurace Na Rynku"); // 186 kg
        response.TopClients[0].WeightKg.Should().Be(186m);
        response.TopClients[1].WeightKg.Should().Be(5m);
        response.ByRegion.Should().HaveCount(2);
        response.ByRegion[0].Region.Should().Be(Region.Leipzig); // ordered by weight desc
    }

    [Fact]
    public async Task HandleAsync_ExcludesShipmentsThatAreNotDelivered()
    {
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Cancelled,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 2)]);

        var endpoint = EndpointWithResponseBuilder<GetClientVolumeRequest,
            ClientVolumeReportDto, GetClientVolumeEndpoint>.Create(fixture.DbContext.Object);

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        endpoint.Response.ClientsServed.Should().Be(0);
        endpoint.Response.TopClients.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleAsync_ExcludesCustomStops()
    {
        // Regression guard for the "order stops only" filter (Task 1 review finding):
        // a Custom-kind stop must contribute nothing to the client report.
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Delivered,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 2)],
            stopKind: OutgoingShipmentStopKind.Custom);

        var endpoint = EndpointWithResponseBuilder<GetClientVolumeRequest,
            ClientVolumeReportDto, GetClientVolumeEndpoint>.Create(fixture.DbContext.Object);

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        var response = endpoint.Response;
        response.ClientsServed.Should().Be(0);
        response.TotalDeliveries.Should().Be(0);
        response.TotalWeightKg.Should().Be(0m);
        response.TopClients.Should().BeEmpty();
        response.ByRegion.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleAsync_CountsDeliveriesAsDistinctStops_NotDistinctDates()
    {
        // Arrange — one client, TWO stops on the SAME delivery date (same shipment).
        // The headline semantic under test: Deliveries/TotalDeliveries must count distinct
        // delivered stops, not distinct dates — collapsing same-date stops into 1 would be wrong.
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Delivered,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 2)]);

        var twoStops = DeliveredShipmentBuilder.AddSecondStopForSameClient(
            fixture,
            lines: [new(ProductKind.Can, ProductType.Radler, CanSize.ZeroPointFiveLiters, quantity: 10)]);

        var endpoint = EndpointWithResponseBuilder<GetClientVolumeRequest,
            ClientVolumeReportDto, GetClientVolumeEndpoint>.Create(twoStops.DbContext.Object);

        // Act
        await endpoint.HandleAsync(Window(), CancellationToken.None);

        // Assert
        var response = endpoint.Response;
        response.ClientsServed.Should().Be(1);
        response.TopClients.Should().HaveCount(1);

        // Same delivery date, two distinct stops — must count as 2, not 1.
        response.TopClients[0].Deliveries.Should().Be(2);
        response.TotalDeliveries.Should().Be(2);
    }

    [Fact]
    public async Task HandleAsync_ReturnsZeroedDto_ForNoData()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var endpoint = EndpointWithResponseBuilder<GetClientVolumeRequest,
            ClientVolumeReportDto, GetClientVolumeEndpoint>.Create(dbContext.Object);

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        var response = endpoint.Response;
        response.ClientsServed.Should().Be(0);
        response.TotalDeliveries.Should().Be(0);
        response.TotalWeightKg.Should().Be(0m);
        response.TopClients.Should().BeEmpty();
        response.ByRegion.Should().BeEmpty();
    }
}
