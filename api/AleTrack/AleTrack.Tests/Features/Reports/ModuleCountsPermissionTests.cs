using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Reports.Queries;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FastEndpoints;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Reports;

public sealed class ModuleCountsPermissionTests
{
    // EndpointWithoutRequest<TResponse> derives from Endpoint<EmptyRequest, TResponse>,
    // not from the non-generic EndpointWithoutRequest, so the with-response builder is
    // the one whose constraint it satisfies.
    private static GetNumberOfRecordsInEachModuleEndpoint CreateEndpoint(
        Mock<AleTrack.Infrastructure.Persistence.AleTrackDbContext> dbContext,
        Mock<IAppContext> appContext,
        IDriverScope driverScope)
        => EndpointWithResponseBuilder<EmptyRequest, NumberOfRecordsInEachModuleDto, GetNumberOfRecordsInEachModuleEndpoint>
            .Create(dbContext.Object, appContext.Object, driverScope);

    [Fact]
    public async Task HandleAsync_CallerHasViewOnSomeModules_ReturnsCountsOnlyForThoseModules()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [ClientBuilder.BuildEntity()],
            drivers: [DriverBuilder.BuildEntity()],
            orders: [OrderBuilder.BuildEntity()],
            breweries: [BreweryBuilder.BuildEntity()]);

        var appContext = new Mock<IAppContext>();
        appContext.Setup(a => a.Permissions).Returns(new Dictionary<ModuleType, PermissionLevel>
        {
            [ModuleType.Clients] = PermissionLevel.View,
            [ModuleType.Drivers] = PermissionLevel.Edit
        });

        var endpoint = CreateEndpoint(dbContext, appContext, DriverScopeMockFactory.Unscoped());
        await endpoint.HandleAsync(CancellationToken.None);

        var result = endpoint.Response;

        result.ClientsCount.Should().Be(1);
        result.DriversCount.Should().Be(1);

        result.OrdersCount.Should().BeNull();
        result.BreweriesCount.Should().BeNull();
        result.InventoryItemsCount.Should().BeNull();
        result.VehiclesCount.Should().BeNull();
        result.UsersCount.Should().BeNull();
        result.OutgoingShipmentsCount.Should().BeNull();
        result.ProductDeliveriesCount.Should().BeNull();
    }

    [Fact]
    public async Task HandleAsync_CallerIsAdmin_ReturnsAllCounts()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [ClientBuilder.BuildEntity()],
            drivers: [DriverBuilder.BuildEntity()],
            orders: [OrderBuilder.BuildEntity()],
            breweries: [BreweryBuilder.BuildEntity()],
            vehicles: [VehicleBuilder.BuildEntity()],
            users: [UserBuilder.BuildEntity()],
            outgoingShipments: [OutgoingShipmentBuilder.BuildEntity()],
            productDeliveries: [ProductDeliveryBuilder.BuildEntity()],
            inventoryItems: [new InventoryItem { Quantity = 3 }]);

        var appContext = new Mock<IAppContext>();
        appContext.Setup(a => a.Permissions).Returns(
            Enum.GetValues<ModuleType>().ToDictionary(m => m, _ => PermissionLevel.Edit));

        var endpoint = CreateEndpoint(dbContext, appContext, DriverScopeMockFactory.Unscoped());
        await endpoint.HandleAsync(CancellationToken.None);

        var result = endpoint.Response;

        result.ClientsCount.Should().Be(1);
        result.DriversCount.Should().Be(1);
        result.OrdersCount.Should().Be(1);
        result.BreweriesCount.Should().Be(1);
        result.VehiclesCount.Should().Be(1);
        result.UsersCount.Should().Be(1);
        result.OutgoingShipmentsCount.Should().Be(1);
        result.ProductDeliveriesCount.Should().Be(1);
        result.InventoryItemsCount.Should().Be(3);
    }

    [Fact]
    public async Task HandleAsync_CallerHasNoPermissions_ReturnsAllNulls()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [ClientBuilder.BuildEntity()],
            drivers: [DriverBuilder.BuildEntity()]);

        var appContext = new Mock<IAppContext>();
        appContext.Setup(a => a.Permissions).Returns(new Dictionary<ModuleType, PermissionLevel>());

        var endpoint = CreateEndpoint(dbContext, appContext, DriverScopeMockFactory.Unscoped());
        await endpoint.HandleAsync(CancellationToken.None);

        var result = endpoint.Response;

        result.ClientsCount.Should().BeNull();
        result.OrdersCount.Should().BeNull();
        result.BreweriesCount.Should().BeNull();
        result.InventoryItemsCount.Should().BeNull();
        result.DriversCount.Should().BeNull();
        result.VehiclesCount.Should().BeNull();
        result.UsersCount.Should().BeNull();
        result.OutgoingShipmentsCount.Should().BeNull();
        result.ProductDeliveriesCount.Should().BeNull();

        dbContext.VerifyGet(d => d.Clients, Times.Never);
        dbContext.VerifyGet(d => d.Drivers, Times.Never);
    }

    [Fact]
    public async Task HandleAsync_DriverScopedCallerLinked_CountsOwnDriverAndOnlyAssignedUnfinishedShipments()
    {
        var mine = DriverBuilder.BuildEntity(id: 1, firstName: "Mine");
        var otherOne = DriverBuilder.BuildEntity(id: 2, firstName: "OtherOne");
        var otherTwo = DriverBuilder.BuildEntity(id: 3, firstName: "OtherTwo");

        var assignedToMeUnfinished = OutgoingShipmentBuilder.BuildEntity(
            drivers: [new OutgoingShipmentDriver { DriverId = 1 }],
            state: OutgoingShipmentState.Created);
        var assignedToMeFinished = OutgoingShipmentBuilder.BuildEntity(
            drivers: [new OutgoingShipmentDriver { DriverId = 1 }],
            state: OutgoingShipmentState.Delivered);
        var assignedToOtherUnfinished = OutgoingShipmentBuilder.BuildEntity(
            drivers: [new OutgoingShipmentDriver { DriverId = 2 }],
            state: OutgoingShipmentState.Created);
        var assignedToBothUnfinished = OutgoingShipmentBuilder.BuildEntity(
            drivers: [new OutgoingShipmentDriver { DriverId = 1 }, new OutgoingShipmentDriver { DriverId = 2 }],
            state: OutgoingShipmentState.Created);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            drivers: [mine, otherOne, otherTwo],
            outgoingShipments:
            [
                assignedToMeUnfinished, assignedToMeFinished, assignedToOtherUnfinished, assignedToBothUnfinished
            ]);

        var appContext = new Mock<IAppContext>();
        appContext.Setup(a => a.Permissions).Returns(new Dictionary<ModuleType, PermissionLevel>
        {
            [ModuleType.Drivers] = PermissionLevel.View,
            [ModuleType.Shipments] = PermissionLevel.View
        });

        var endpoint = CreateEndpoint(dbContext, appContext, DriverScopeMockFactory.Scoped(1));
        await endpoint.HandleAsync(CancellationToken.None);

        var result = endpoint.Response;

        result.DriversCount.Should().Be(1);
        result.OutgoingShipmentsCount.Should().Be(2);
    }

    [Fact]
    public async Task HandleAsync_DriverScopedCallerUnlinked_CountsAreZeroNotFleetTotals()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            drivers: [DriverBuilder.BuildEntity(id: 1), DriverBuilder.BuildEntity(id: 2), DriverBuilder.BuildEntity(id: 3)],
            outgoingShipments:
            [
                OutgoingShipmentBuilder.BuildEntity(
                    drivers: [new OutgoingShipmentDriver { DriverId = 1 }], state: OutgoingShipmentState.Created),
                OutgoingShipmentBuilder.BuildEntity(
                    drivers: [new OutgoingShipmentDriver { DriverId = 2 }], state: OutgoingShipmentState.Created)
            ]);

        var appContext = new Mock<IAppContext>();
        appContext.Setup(a => a.Permissions).Returns(new Dictionary<ModuleType, PermissionLevel>
        {
            [ModuleType.Drivers] = PermissionLevel.View,
            [ModuleType.Shipments] = PermissionLevel.View
        });

        var endpoint = CreateEndpoint(dbContext, appContext, DriverScopeMockFactory.ScopedUnlinked());
        await endpoint.HandleAsync(CancellationToken.None);

        var result = endpoint.Response;

        result.DriversCount.Should().Be(0);
        result.OutgoingShipmentsCount.Should().Be(0);
    }

    [Fact]
    public async Task HandleAsync_UnscopedCallerWithMultipleRecords_ReturnsFleetTotals()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            drivers: [DriverBuilder.BuildEntity(id: 1), DriverBuilder.BuildEntity(id: 2), DriverBuilder.BuildEntity(id: 3)],
            outgoingShipments:
            [
                OutgoingShipmentBuilder.BuildEntity(
                    drivers: [new OutgoingShipmentDriver { DriverId = 1 }], state: OutgoingShipmentState.Created),
                OutgoingShipmentBuilder.BuildEntity(
                    drivers: [new OutgoingShipmentDriver { DriverId = 1 }], state: OutgoingShipmentState.Delivered),
                OutgoingShipmentBuilder.BuildEntity(
                    drivers: [new OutgoingShipmentDriver { DriverId = 2 }], state: OutgoingShipmentState.Created),
                OutgoingShipmentBuilder.BuildEntity(
                    drivers: [new OutgoingShipmentDriver { DriverId = 1 }, new OutgoingShipmentDriver { DriverId = 2 }],
                    state: OutgoingShipmentState.Created)
            ]);

        var appContext = new Mock<IAppContext>();
        appContext.Setup(a => a.Permissions).Returns(new Dictionary<ModuleType, PermissionLevel>
        {
            [ModuleType.Drivers] = PermissionLevel.View,
            [ModuleType.Shipments] = PermissionLevel.View
        });

        var endpoint = CreateEndpoint(dbContext, appContext, DriverScopeMockFactory.Unscoped());
        await endpoint.HandleAsync(CancellationToken.None);

        var result = endpoint.Response;

        result.DriversCount.Should().Be(3);
        result.OutgoingShipmentsCount.Should().Be(3);
    }
}
