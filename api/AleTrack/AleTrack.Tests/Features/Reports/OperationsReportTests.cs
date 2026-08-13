using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Products.Utils;
using AleTrack.Features.Reports.Queries.Operations;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.Reports;

public sealed class GetOperationsEndpointTests
{
    private static GetOperationsRequest Window() => new()
    {
        From = new DateOnly(2026, 7, 1),
        To = new DateOnly(2026, 7, 31)
    };

    private static GetOperationsEndpoint Endpoint(DeliveredShipmentFixture fixture) =>
        EndpointWithResponseBuilder<GetOperationsRequest, OperationsReportDto, GetOperationsEndpoint>
            .Create(fixture.DbContext.Object, DriverScopeMockFactory.Unscoped());

    [Fact]
    public async Task HandleAsync_CountsShipmentsByStateStopsAndDrivers()
    {
        // Arrange — one delivered shipment, one stop, one driver.
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Delivered,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 2)]);

        var endpoint = Endpoint(fixture);

        // Act
        await endpoint.HandleAsync(Window(), CancellationToken.None);

        // Assert
        var response = endpoint.Response;
        response.Should().NotBeNull();
        response.TotalShipments.Should().Be(1);
        response.TotalStops.Should().Be(1);
        response.ShipmentsByState.Should().HaveCount(1);
        response.ShipmentsByState[0].State.Should().Be(OutgoingShipmentState.Delivered);
        response.ShipmentsByState[0].Count.Should().Be(1);
        response.ActiveDrivers.Should().Be(1);
        response.ByDriver.Should().HaveCount(1);
        response.ByDriver[0].DriverName.Should().Be("Jan Novák");
        response.ByDriver[0].Color.Should().Be("#0072B2");
        response.ByDriver[0].DeliveredShipments.Should().Be(1);
    }

    [Fact]
    public async Task HandleAsync_CountsNonDeliveredShipmentsInStateBreakdown_ButNotForDrivers()
    {
        // A shipment still in transit belongs in the state donut, but it has not been
        // delivered, so it must not count towards a driver's delivered tally.
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.InTransit,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 2)]);

        var endpoint = Endpoint(fixture);

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        var response = endpoint.Response;
        response.TotalShipments.Should().Be(1);
        response.ShipmentsByState.Should().HaveCount(1);
        response.ShipmentsByState[0].State.Should().Be(OutgoingShipmentState.InTransit);
        response.ByDriver.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleAsync_ComputesOnTimePercentage_ExcludingOrdersWithoutRequiredDate()
    {
        // On time: actual 2026-07-19 <= required 2026-07-20.
        var onTime = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Delivered,
            orderState: OrderState.Finished,
            requiredDeliveryDate: new DateOnly(2026, 7, 20),
            actualDeliveryDate: new DateOnly(2026, 7, 19),
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 1)]);

        var endpoint = Endpoint(onTime);
        await endpoint.HandleAsync(Window(), CancellationToken.None);
        endpoint.Response.OnTimePercentage.Should().Be(100m);

        // Late: actual 2026-07-22 > required 2026-07-20.
        var late = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Delivered,
            orderState: OrderState.Finished,
            requiredDeliveryDate: new DateOnly(2026, 7, 20),
            actualDeliveryDate: new DateOnly(2026, 7, 22),
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 1)]);

        var lateEndpoint = Endpoint(late);
        await lateEndpoint.HandleAsync(Window(), CancellationToken.None);
        lateEndpoint.Response.OnTimePercentage.Should().Be(0m);

        // No required date — excluded from the ratio entirely, so it reads 0 of 0.
        var noRequired = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Delivered,
            orderState: OrderState.Finished,
            requiredDeliveryDate: null,
            actualDeliveryDate: new DateOnly(2026, 7, 19),
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 1)]);

        var noRequiredEndpoint = Endpoint(noRequired);
        await noRequiredEndpoint.HandleAsync(Window(), CancellationToken.None);
        noRequiredEndpoint.Response.OnTimePercentage.Should().Be(0m);

        // Mixed: one on-time order (required 07-20, actual 07-19) plus one order with a null
        // RequiredDeliveryDate on the SAME shipment. If the null-required order were counted as
        // late instead of excluded from the denominator, this would read 50m (1 of 2), not 100m
        // (1 of 1) — the single-order fixtures above cannot distinguish those two outcomes since
        // both give 0%/100% either way.
        var mixedBase = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Delivered,
            orderState: OrderState.Finished,
            requiredDeliveryDate: new DateOnly(2026, 7, 20),
            actualDeliveryDate: new DateOnly(2026, 7, 19),
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 1)]);

        var mixed = DeliveredShipmentBuilder.AddSecondStopForSameClient(
            mixedBase,
            requiredDeliveryDate: null,
            actualDeliveryDate: new DateOnly(2026, 7, 19),
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 1)]);

        var mixedEndpoint = Endpoint(mixed);
        await mixedEndpoint.HandleAsync(Window(), CancellationToken.None);
        mixedEndpoint.Response.OnTimePercentage.Should().Be(100m);
    }

    [Fact]
    public async Task HandleAsync_SumsReturnableUnits_OnDeliveredShipmentsOnly()
    {
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Delivered,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 4)],
            returns:
            [
                new OrderReturn { Name = "Sud 50 l — prázdný", Quantity = 3 },
                new OrderReturn { Name = "Basa", Quantity = 2 }
            ]);

        // A second shipment, still InTransit, with its own returns. Because `delivered.Sum(...)`
        // and `shipments.Sum(...)` are numerically identical when the fixture has only one
        // (Delivered) shipment, a swap of one for the other would ship silently without this:
        // the InTransit shipment's 10 returned units must NOT be added to the total below.
        var withSecondShipment = DeliveredShipmentBuilder.AddSecondShipment(
            fixture,
            deliveryDate: new DateTime(2026, 7, 22, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.InTransit,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 2)],
            returns: [new OrderReturn { Name = "Sud 30 l — prázdný", Quantity = 10 }]);

        var endpoint = Endpoint(withSecondShipment);

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        endpoint.Response.ReturnableUnits.Should().Be(5);
    }

    [Fact]
    public async Task HandleAsync_ReportsIncomingAndOutgoingWeightPerMonth()
    {
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Delivered,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 2)]);

        // Incoming: 5 kegs of 30 l = 5 x 42 kg = 210 kg, same month.
        var withIncoming = DeliveredShipmentBuilder.WithIncomingDelivery(
            fixture,
            date: new DateOnly(2026, 7, 15),
            kind: ProductKind.Keg,
            packageSize: KegSize.ThirtyLiters,
            quantity: 5);

        var endpoint = Endpoint(withIncoming);

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        var response = endpoint.Response;
        response.IncomingVsOutgoing.Should().HaveCount(1);
        response.IncomingVsOutgoing[0].Month.Should().Be(new DateOnly(2026, 7, 1));
        response.IncomingVsOutgoing[0].IncomingWeightKg.Should().Be(210m);
        response.IncomingVsOutgoing[0].OutgoingWeightKg.Should().Be(124m);
    }

    /// <summary>
    /// The incoming half of the chart must hold as still as the outgoing half, or one series moves
    /// under a product edit while the other stays put — which is exactly the inconsistency this
    /// snapshot closes.
    /// </summary>
    [Fact]
    public async Task HandleAsync_IncomingWeights_DoNotFollowLaterProductEdits()
    {
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Delivered,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 2)]);

        var withIncoming = DeliveredShipmentBuilder.WithIncomingDelivery(
            fixture,
            date: new DateOnly(2026, 7, 15),
            kind: ProductKind.Keg,
            packageSize: KegSize.ThirtyLiters,
            quantity: 5);

        var before = Endpoint(withIncoming);
        await before.HandleAsync(Window(), CancellationToken.None);
        var incomingBefore = before.Response.IncomingVsOutgoing[0].IncomingWeightKg;

        // Restate the booked-in product the way a data correction would. Reached through the
        // mocked DbSet because the incoming product is internal to WithIncomingDelivery.
        var incomingProduct = withIncoming.DbContext.Object.DeliveryItems.Single().Product;
        incomingProduct.PackageSize = 5;
        incomingProduct.UnitsPerPackage = 1;
        incomingProduct.Kind = ProductKind.Bottle;

        var after = Endpoint(withIncoming);
        await after.HandleAsync(Window(), CancellationToken.None);

        after.Response.IncomingVsOutgoing[0].IncomingWeightKg.Should().Be(incomingBefore);
        incomingBefore.Should().Be(210m, "5 kegs of 30 l is 5 x 42 kg");
    }

    [Fact]
    public async Task HandleAsync_ExcludesNonFinishedIncomingDeliveriesFromIncomingWeight()
    {
        var fixture = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Delivered,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, KegSize.FiftyLiters, quantity: 2)]);

        // A Dovoz still InPlanning must not inflate IncomingWeightKg — only Finished deliveries
        // are actuals. Outgoing is already delivered-only; this pins the same rule on the
        // incoming side of the shared-axis chart.
        var withPlannedIncoming = DeliveredShipmentBuilder.WithIncomingDelivery(
            fixture,
            date: new DateOnly(2026, 7, 15),
            kind: ProductKind.Keg,
            packageSize: KegSize.ThirtyLiters,
            quantity: 5,
            state: ProductDeliveryState.InPlanning);

        var endpoint = Endpoint(withPlannedIncoming);

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        // The planned delivery contributes no month bucket at all — outgoing weight still shows.
        var response = endpoint.Response;
        response.IncomingVsOutgoing.Should().HaveCount(1);
        response.IncomingVsOutgoing[0].IncomingWeightKg.Should().Be(0m);
        response.IncomingVsOutgoing[0].OutgoingWeightKg.Should().Be(124m);
    }

    [Fact]
    public async Task HandleAsync_ReturnsZeroedDto_ForEmptyWindow()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var endpoint = EndpointWithResponseBuilder<GetOperationsRequest,
            OperationsReportDto, GetOperationsEndpoint>.Create(dbContext.Object, DriverScopeMockFactory.Unscoped());

        await endpoint.HandleAsync(Window(), CancellationToken.None);

        var response = endpoint.Response;
        response.TotalShipments.Should().Be(0);
        response.TotalStops.Should().Be(0);
        response.OnTimePercentage.Should().Be(0m);
        response.ReturnableUnits.Should().Be(0);
        response.ActiveDrivers.Should().Be(0);
        response.ShipmentsByState.Should().BeEmpty();
        response.IncomingVsOutgoing.Should().BeEmpty();
        response.ByDriver.Should().BeEmpty();
    }
}
