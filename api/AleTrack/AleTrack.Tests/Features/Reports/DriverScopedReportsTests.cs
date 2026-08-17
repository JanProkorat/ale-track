using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.ProductDeliveries.Utils;
using AleTrack.Features.Reports.Queries.ClientVolume;
using AleTrack.Features.Reports.Queries.DeliveryVolume;
using AleTrack.Features.Reports.Queries.Operations;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Reports;

/// <summary>
/// A Driver-role caller must see a Reports figure about their own work only — never the
/// company's. Every fixture here seeds TWO drivers with a mix of owned/foreign records so a
/// scoping bug that happens to leak the whole company cannot coincidentally produce the right
/// number.
/// </summary>
public sealed class DriverScopedReportsTests
{
    private static DateOnly From => new(2026, 7, 1);
    private static DateOnly To => new(2026, 7, 31);

    /// <summary>
    /// Two drivers, two delivered shipments (one per driver, same shared client), two finished
    /// orders (one on-time, one late) and two finished incoming deliveries (one per driver).
    /// </summary>
    private sealed record Fixture(
        Mock<AleTrackDbContext> DbContext,
        Driver DriverA,
        Driver DriverB);

    private static Fixture Build()
    {
        var brewery = BreweryBuilder.BuildEntity(name: "Pivovar Zittau", color: "#E69F00");
        brewery.Id = 1;

        var client = ClientBuilder.BuildEntity(name: "Hospoda U Kotvy", region: Region.ZittauCity);
        client.Id = 1;

        var driverA = DriverBuilder.BuildEntity(firstName: "Anna", lastName: "Řidičová", color: "#0072B2");
        driverA.Id = 1;

        var driverB = DriverBuilder.BuildEntity(firstName: "Boris", lastName: "Cizí", color: "#D55E00");
        driverB.Id = 2;

        // Orders — one on-time, one late, so a punctuality filter that leaks the wrong driver's
        // order changes the percentage rather than leaving it coincidentally unchanged.
        var orderA = new Order
        {
            Id = 1,
            PublicId = Guid.NewGuid(),
            Client = client,
            ClientId = client.Id,
            State = OrderState.Finished,
            CreatedDate = new DateTime(2026, 7, 3, 0, 0, 0, DateTimeKind.Utc),
            RequiredDeliveryDate = new DateOnly(2026, 7, 10),
            ActualDeliveryDate = new DateOnly(2026, 7, 10)
        };

        var orderB = new Order
        {
            Id = 2,
            PublicId = Guid.NewGuid(),
            Client = client,
            ClientId = client.Id,
            State = OrderState.Finished,
            CreatedDate = new DateTime(2026, 7, 3, 0, 0, 0, DateTimeKind.Utc),
            RequiredDeliveryDate = new DateOnly(2026, 7, 10),
            ActualDeliveryDate = new DateOnly(2026, 7, 15)
        };

        // Order lines — different kinds/quantities so a wrong aggregate cannot land on the right
        // number by coincidence: 2 kegs of 50 l = 124 kg, 10 cans of 0.5 l = 5 kg.
        var orderProductA = ProductBuilder.BuildEntity(
            name: "Produkt A", kind: ProductKind.Keg, type: ProductType.PaleLager, packageSize: 50);
        orderProductA.Id = 1;
        orderProductA.BreweryId = brewery.Id;
        orderProductA.Brewery = brewery;

        var orderProductB = ProductBuilder.BuildEntity(
            name: "Produkt B", kind: ProductKind.Can, type: ProductType.Radler, packageSize: 0.5);
        orderProductB.Id = 2;
        orderProductB.BreweryId = brewery.Id;
        orderProductB.Brewery = brewery;

        var orderItemA = new OrderItem
        {
            Id = 1,
            PublicId = Guid.NewGuid(),
            OrderId = orderA.Id,
            Order = orderA,
            ProductId = orderProductA.Id,
            Product = orderProductA,
            Quantity = 2
        };
        orderA.OrderItems = [orderItemA];

        var orderItemB = new OrderItem
        {
            Id = 2,
            PublicId = Guid.NewGuid(),
            OrderId = orderB.Id,
            Order = orderB,
            ProductId = orderProductB.Id,
            Product = orderProductB,
            Quantity = 10
        };
        orderB.OrderItems = [orderItemB];

        // Shipment A — driver A only.
        var shipmentA = OutgoingShipmentBuilder.BuildEntity(
            deliveryDate: new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Delivered);
        shipmentA.Id = 1;
        shipmentA.Drivers =
        [
            new OutgoingShipmentDriver
                { DriverId = driverA.Id, Driver = driverA, OutgoingShipmentId = shipmentA.Id, OutgoingShipment = shipmentA }
        ];

        var stopA = new OutgoingShipmentStop
        {
            Id = 1,
            PublicId = Guid.NewGuid(),
            Kind = OutgoingShipmentStopKind.Order,
            Order = 1,
            OutgoingShipmentId = shipmentA.Id,
            OutgoingShipment = shipmentA,
            ClientOrder = orderA
        };
        shipmentA.Stops = [stopA];
        orderA.OutgoingShipmentStop = stopA;
        orderA.OutgoingShipmentStopId = stopA.Id;

        // Shipment B — driver B only, same client, same delivery date.
        var shipmentB = OutgoingShipmentBuilder.BuildEntity(
            deliveryDate: new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Delivered);
        shipmentB.Id = 2;
        shipmentB.Drivers =
        [
            new OutgoingShipmentDriver
                { DriverId = driverB.Id, Driver = driverB, OutgoingShipmentId = shipmentB.Id, OutgoingShipment = shipmentB }
        ];

        var stopB = new OutgoingShipmentStop
        {
            Id = 2,
            PublicId = Guid.NewGuid(),
            Kind = OutgoingShipmentStopKind.Order,
            Order = 1,
            OutgoingShipmentId = shipmentB.Id,
            OutgoingShipment = shipmentB,
            ClientOrder = orderB
        };
        shipmentB.Stops = [stopB];
        orderB.OutgoingShipmentStop = stopB;
        orderB.OutgoingShipmentStopId = stopB.Id;

        ShipmentContentSnapshotWriter.Apply(shipmentA, new Dictionary<long, ClientPriceList>());
        ShipmentContentSnapshotWriter.Apply(shipmentB, new Dictionary<long, ClientPriceList>());

        var stopItems = shipmentA.Stops.SelectMany(s => s.Items)
            .Concat(shipmentB.Stops.SelectMany(s => s.Items))
            .ToList();

        var nextStopItemId = 1000L;
        foreach (var item in stopItems)
        {
            item.Id = nextStopItemId++;
            item.StopId = item.Stop.Id;
        }

        // Incoming deliveries (Dovozy) — one driven by each driver, different products so the
        // two sides of the shared-axis chart are distinguishable: 5 kegs of 30 l = 210 kg,
        // 4 cans of 0.5 l = 2 kg.
        var incomingProductA = ProductBuilder.BuildEntity(
            name: "Dovezený produkt A", kind: ProductKind.Keg, type: ProductType.PaleLager, packageSize: 30);
        incomingProductA.Id = 3;
        incomingProductA.BreweryId = brewery.Id;
        incomingProductA.Brewery = brewery;

        var incomingProductB = ProductBuilder.BuildEntity(
            name: "Dovezený produkt B", kind: ProductKind.Can, type: ProductType.Radler, packageSize: 0.5);
        incomingProductB.Id = 4;
        incomingProductB.BreweryId = brewery.Id;
        incomingProductB.Brewery = brewery;

        var deliveryA = new ProductDelivery
        {
            Id = 1,
            PublicId = Guid.NewGuid(),
            Date = new DateOnly(2026, 7, 15),
            State = ProductDeliveryState.Finished,
            Drivers = [driverA]
        };

        var deliveryStopA = new DeliveryStop
        {
            Id = 1,
            PublicId = Guid.NewGuid(),
            DeliveryId = deliveryA.Id,
            Delivery = deliveryA,
            Order = 1,
            Kind = DeliveryStopKind.Brewery,
            BreweryId = brewery.Id
        };

        var deliveryItemA = new DeliveryItem
        {
            Id = 1,
            DeliveryStopId = deliveryStopA.Id,
            DeliveryStop = deliveryStopA,
            ProductId = incomingProductA.Id,
            Product = incomingProductA,
            Quantity = 5
        };
        DeliveryItemSnapshot.Apply(deliveryItemA, incomingProductA);

        deliveryStopA.Items = [deliveryItemA];
        deliveryA.Stops = [deliveryStopA];

        var deliveryB = new ProductDelivery
        {
            Id = 2,
            PublicId = Guid.NewGuid(),
            Date = new DateOnly(2026, 7, 15),
            State = ProductDeliveryState.Finished,
            Drivers = [driverB]
        };

        var deliveryStopB = new DeliveryStop
        {
            Id = 2,
            PublicId = Guid.NewGuid(),
            DeliveryId = deliveryB.Id,
            Delivery = deliveryB,
            Order = 1,
            Kind = DeliveryStopKind.Brewery,
            BreweryId = brewery.Id
        };

        var deliveryItemB = new DeliveryItem
        {
            Id = 2,
            DeliveryStopId = deliveryStopB.Id,
            DeliveryStop = deliveryStopB,
            ProductId = incomingProductB.Id,
            Product = incomingProductB,
            Quantity = 4
        };
        DeliveryItemSnapshot.Apply(deliveryItemB, incomingProductB);

        deliveryStopB.Items = [deliveryItemB];
        deliveryB.Stops = [deliveryStopB];

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            clients: [client],
            breweries: [brewery],
            products: [orderProductA, orderProductB, incomingProductA, incomingProductB],
            orders: [orderA, orderB],
            orderItems: [orderItemA, orderItemB],
            drivers: [driverA, driverB],
            productDeliveries: [deliveryA, deliveryB],
            deliveryItems: [deliveryItemA, deliveryItemB],
            outgoingShipments: [shipmentA, shipmentB],
            outgoingShipmentStopItems: stopItems);

        return new Fixture(dbContext, driverA, driverB);
    }

    private static GetOperationsRequest OperationsWindow() => new() { From = From, To = To };
    private static GetDeliveryVolumeRequest DeliveryVolumeWindow() => new() { From = From, To = To };
    private static GetClientVolumeRequest ClientVolumeWindow() => new() { From = From, To = To };

    public sealed class OperationsScope
    {
        [Fact]
        public async Task HandleAsync_DriverScoped_SeesOnlyOwnShipmentsAndByDriver()
        {
            var fixture = Build();

            var endpoint = EndpointWithResponseBuilder<GetOperationsRequest,
                OperationsReportDto, GetOperationsEndpoint>.Create(
                fixture.DbContext.Object, DriverScopeMockFactory.Scoped(fixture.DriverA.Id));

            await endpoint.HandleAsync(OperationsWindow(), CancellationToken.None);

            var response = endpoint.Response;
            response.TotalShipments.Should().Be(1);
            response.TotalStops.Should().Be(1);

            // The specific thing this task exists to stop: a colleague's name/throughput leaking
            // into a driver's own report.
            response.ByDriver.Should().HaveCount(1);
            response.ByDriver[0].DriverName.Should().Be("Anna Řidičová");
            response.ByDriver.Should().NotContain(d => d.DriverName == "Boris Cizí");
        }

        [Fact]
        public async Task HandleAsync_UnlinkedDriverScoped_ReturnsEmptyReport()
        {
            var fixture = Build();

            var endpoint = EndpointWithResponseBuilder<GetOperationsRequest,
                OperationsReportDto, GetOperationsEndpoint>.Create(
                fixture.DbContext.Object, DriverScopeMockFactory.ScopedUnlinked());

            await endpoint.HandleAsync(OperationsWindow(), CancellationToken.None);

            var response = endpoint.Response;
            response.TotalShipments.Should().Be(0);
            response.TotalStops.Should().Be(0);
            response.ShipmentsByState.Should().BeEmpty();
            response.ByDriver.Should().BeEmpty();
            response.OnTimePercentage.Should().Be(0m);
            response.IncomingVsOutgoing.Should().BeEmpty();
        }

        [Fact]
        public async Task HandleAsync_DriverScoped_IncomingSeries_CountsOnlyOwnDeliveries()
        {
            var fixture = Build();

            var endpoint = EndpointWithResponseBuilder<GetOperationsRequest,
                OperationsReportDto, GetOperationsEndpoint>.Create(
                fixture.DbContext.Object, DriverScopeMockFactory.Scoped(fixture.DriverA.Id));

            await endpoint.HandleAsync(OperationsWindow(), CancellationToken.None);

            var response = endpoint.Response;
            response.IncomingVsOutgoing.Should().HaveCount(1);
            // Driver A's own incoming delivery is 5 kegs of 30 l = 210 kg; driver B's 4 cans of
            // 0.5 l (2 kg) must not be added in.
            response.IncomingVsOutgoing[0].IncomingWeightKg.Should().Be(210m);
            response.IncomingVsOutgoing[0].OutgoingWeightKg.Should().Be(124m);
        }

        [Fact]
        public async Task HandleAsync_DriverScoped_Punctuality_CountsOnlyOwnOrders()
        {
            var fixture = Build();

            var endpoint = EndpointWithResponseBuilder<GetOperationsRequest,
                OperationsReportDto, GetOperationsEndpoint>.Create(
                fixture.DbContext.Object, DriverScopeMockFactory.Scoped(fixture.DriverA.Id));

            await endpoint.HandleAsync(OperationsWindow(), CancellationToken.None);

            // Driver A's own order was delivered on time. Driver B's late order must not be mixed
            // in — if it were, this would read 50%, not 100%.
            endpoint.Response.OnTimePercentage.Should().Be(100m);
        }

        [Fact]
        public async Task HandleAsync_Unscoped_SeesEveryDriverAndShipment()
        {
            var fixture = Build();

            var endpoint = EndpointWithResponseBuilder<GetOperationsRequest,
                OperationsReportDto, GetOperationsEndpoint>.Create(
                fixture.DbContext.Object, DriverScopeMockFactory.Unscoped());

            await endpoint.HandleAsync(OperationsWindow(), CancellationToken.None);

            var response = endpoint.Response;
            response.TotalShipments.Should().Be(2);
            response.ByDriver.Should().HaveCount(2);
            response.ByDriver.Select(d => d.DriverName).Should().Contain(["Anna Řidičová", "Boris Cizí"]);

            // Both incoming deliveries and both order lines land in the same July bucket.
            response.IncomingVsOutgoing.Should().HaveCount(1);
            response.IncomingVsOutgoing[0].IncomingWeightKg.Should().Be(212m);
            response.IncomingVsOutgoing[0].OutgoingWeightKg.Should().Be(129m);

            // One on-time (driver A), one late (driver B) — a filter that only ever restricts
            // would never reach 50%.
            response.OnTimePercentage.Should().Be(50m);
        }
    }

    public sealed class DeliveryVolumeScope
    {
        [Fact]
        public async Task HandleAsync_DriverScoped_SeesOnlyOwnDeliveredLines()
        {
            var fixture = Build();

            var endpoint = EndpointWithResponseBuilder<GetDeliveryVolumeRequest,
                DeliveryVolumeReportDto, GetDeliveryVolumeEndpoint>.Create(
                fixture.DbContext.Object, DriverScopeMockFactory.Scoped(fixture.DriverA.Id));

            await endpoint.HandleAsync(DeliveryVolumeWindow(), CancellationToken.None);

            var response = endpoint.Response;
            response.TotalWeightKg.Should().Be(124m);
            response.TotalUnits.Should().Be(2);
        }

        [Fact]
        public async Task HandleAsync_Unscoped_SeesAllDeliveredLines()
        {
            var fixture = Build();

            var endpoint = EndpointWithResponseBuilder<GetDeliveryVolumeRequest,
                DeliveryVolumeReportDto, GetDeliveryVolumeEndpoint>.Create(
                fixture.DbContext.Object, DriverScopeMockFactory.Unscoped());

            await endpoint.HandleAsync(DeliveryVolumeWindow(), CancellationToken.None);

            var response = endpoint.Response;
            response.TotalWeightKg.Should().Be(129m);
            response.TotalUnits.Should().Be(12);
        }
    }

    public sealed class ClientVolumeScope
    {
        [Fact]
        public async Task HandleAsync_DriverScoped_SeesOnlyOwnDeliveredLines_ForSharedClient()
        {
            var fixture = Build();

            var endpoint = EndpointWithResponseBuilder<GetClientVolumeRequest,
                ClientVolumeReportDto, GetClientVolumeEndpoint>.Create(
                fixture.DbContext.Object, DriverScopeMockFactory.Scoped(fixture.DriverA.Id));

            await endpoint.HandleAsync(ClientVolumeWindow(), CancellationToken.None);

            // Both drivers' stops belong to the SAME client — a client-level (rather than
            // row-level) filter bug would still show the full 129 kg for this client.
            var response = endpoint.Response;
            response.TotalWeightKg.Should().Be(124m);
            response.TotalDeliveries.Should().Be(1);
            response.TopClients.Should().HaveCount(1);
            response.TopClients[0].WeightKg.Should().Be(124m);
            response.TopClients[0].Deliveries.Should().Be(1);
        }

        [Fact]
        public async Task HandleAsync_Unscoped_SeesAllDeliveredLines_ForSharedClient()
        {
            var fixture = Build();

            var endpoint = EndpointWithResponseBuilder<GetClientVolumeRequest,
                ClientVolumeReportDto, GetClientVolumeEndpoint>.Create(
                fixture.DbContext.Object, DriverScopeMockFactory.Unscoped());

            await endpoint.HandleAsync(ClientVolumeWindow(), CancellationToken.None);

            var response = endpoint.Response;
            response.TotalWeightKg.Should().Be(129m);
            response.TotalDeliveries.Should().Be(2);
            response.TopClients.Should().HaveCount(1);
            response.TopClients[0].WeightKg.Should().Be(129m);
            response.TopClients[0].Deliveries.Should().Be(2);
        }
    }
}
