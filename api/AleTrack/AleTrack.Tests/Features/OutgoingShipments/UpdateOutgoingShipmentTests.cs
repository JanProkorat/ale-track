using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Options;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Commands.Update;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Moq;

namespace AleTrack.Tests.Features.OutgoingShipments;

public sealed class UpdateOutgoingShipmentTests
{
    [Fact]
    public async Task ProcessAsync_UpdateOutgoingShipment_Success()
    {
        var shipmentId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var vehicle = VehicleBuilder.BuildEntity(publicId: vehicleId);

        var driver1Id = Guid.NewGuid();
        var driver2Id = Guid.NewGuid();
        var driver1 = DriverBuilder.BuildEntity(publicId: driver1Id);
        var driver2 = DriverBuilder.BuildEntity(publicId: driver2Id);

        var order1Id = Guid.NewGuid();
        var order2Id = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order1 = OrderBuilder.BuildEntity(publicId: order1Id, client: client);
        var order2 = OrderBuilder.BuildEntity(publicId: order2Id, client: client);

        var outgoingShipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            deliveryDate: DateTime.UtcNow.AddDays(1),
            state: OutgoingShipmentState.Created
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            outgoingShipments: [outgoingShipment],
            vehicles: [vehicle],
            drivers: [driver1, driver2],
            orders: [order1, order2]
        );

        var newDeliveryDate = DateTime.UtcNow.AddDays(3);
        var command = new UpdateOutgoingShipmentRequest
        {
            Id = shipmentId,
            Data = OutgoingShipmentBuilder.BuildUpdateDto(
                deliveryDate: newDeliveryDate,
                vehicleId: vehicleId,
                driverIds: [driver1Id, driver2Id],
                clientOrderShipments:
                [
                    new ClientOrderShipmentDto
                    {
                        ClientOrderId = order1Id,
                        Order = 1
                    },
                    new ClientOrderShipmentDto
                    {
                        ClientOrderId = order2Id,
                        Order = 2
                    }
                ],
                state: OutgoingShipmentState.Created
            )
        };

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(dbContext.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Unscoped());
        
        // Manually set up callback to simulate EF Core behavior of setting VehicleId when Vehicle is set
        dbContext.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .Callback(() =>
            {
                if (outgoingShipment.Vehicle != null)
                    outgoingShipment.VehicleId = outgoingShipment.Vehicle.Id;
                if (outgoingShipment.Drivers.Count > 0)
                {
                    // Simulate EF setting IDs
                }
            })
            .ReturnsAsync(1);
        
        await endpoint.HandleAsync(command, CancellationToken.None);

        // Verify that the outgoing shipment entity was updated with correct values
        outgoingShipment.DeliveryDate.Should().Be(newDeliveryDate);
        outgoingShipment.State.Should().Be(OutgoingShipmentState.Created);
        outgoingShipment.Vehicle.Should().Be(vehicle);
        outgoingShipment.Drivers.Should().HaveCount(2);
        outgoingShipment.Stops.Should().HaveCount(2);

        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_UpdateOutgoingShipment_CustomStops_UpdatesExistingAndAddsNew()
    {
        var shipmentId = Guid.NewGuid();
        var existingCustomId = Guid.NewGuid();

        var existingCustom = new OutgoingShipmentStop
        {
            PublicId = existingCustomId,
            Kind = OutgoingShipmentStopKind.Custom,
            Order = 1,
            Label = "Old label",
            Latitude = 50.1m,
            Longitude = 14.1m
        };

        var outgoingShipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            state: OutgoingShipmentState.Created,
            stops: [existingCustom]
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(outgoingShipments: [outgoingShipment]);
        dbContext.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var command = new UpdateOutgoingShipmentRequest
        {
            Id = shipmentId,
            Data = new UpdateOutgoingShipmentDto
            {
                Name = "vyvoz",
                DeliveryDate = DateTime.UtcNow.AddDays(1),
                DriverIds = [],
                ClientOrderShipments = [],
                State = OutgoingShipmentState.Created,
                CustomStops =
                [
                    new CustomStopDto { Id = existingCustomId, Order = 1, Label = "New label", Latitude = 50.2m, Longitude = 14.2m },
                    new CustomStopDto { Id = null, Order = 2, Label = "Čerpací stanice", Latitude = 50.3m, Longitude = 14.3m }
                ]
            }
        };

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(dbContext.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Unscoped());

        await endpoint.HandleAsync(command, CancellationToken.None);

        outgoingShipment.Stops.Should().HaveCount(2);
        outgoingShipment.Stops.Should().OnlyContain(s => s.Kind == OutgoingShipmentStopKind.Custom);
        var updated = outgoingShipment.Stops.First(s => s.PublicId == existingCustomId);
        updated.Label.Should().Be("New label");
        updated.Latitude.Should().Be(50.2m);
        outgoingShipment.Stops.Should().ContainSingle(s => s.Label == "Čerpací stanice");
    }

    [Fact]
    public async Task ProcessAsync_UpdateOutgoingShipment_ExistingStockPurchaseWithoutProductId_Success()
    {
        // Regression: re-sending an existing dokládka whose ProductId is not
        // round-tripped (empty) must update it in place, not trigger a Product
        // lookup on Guid.Empty (which threw ENTITY_NOT_FOUND).
        var shipmentId = Guid.NewGuid();
        var extraId = Guid.NewGuid();
        var product = ProductBuilder.BuildEntity(publicId: Guid.NewGuid());

        var existingExtra = new OutgoingShipmentStockPurchaseItem
        {
            PublicId = extraId,
            Product = product,
            Quantity = 2,
            IsShipmentLoadingConfirmed = false
        };

        var outgoingShipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            state: OutgoingShipmentState.Created
        );
        outgoingShipment.StockPurchases = [existingExtra];

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            outgoingShipments: [outgoingShipment],
            products: [product]
        );
        dbContext.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var command = new UpdateOutgoingShipmentRequest
        {
            Id = shipmentId,
            Data = new UpdateOutgoingShipmentDto
            {
                Name = "vyvoz",
                DeliveryDate = DateTime.UtcNow.AddDays(1),
                DriverIds = [],
                ClientOrderShipments = [],
                State = OutgoingShipmentState.Created,
                StockPurchases =
                [
                    new StockPurchaseDto
                    {
                        Id = extraId,
                        ProductId = Guid.Empty,
                        Quantity = 7,
                        IsLoadingConfirmed = true
                    }
                ]
            }
        };

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(dbContext.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Unscoped());

        await endpoint.HandleAsync(command, CancellationToken.None);

        outgoingShipment.StockPurchases.Should().ContainSingle();
        existingExtra.Quantity.Should().Be(7);
        existingExtra.IsShipmentLoadingConfirmed.Should().BeTrue();
        existingExtra.Product.Should().Be(product);
    }

    [Fact]
    public async Task ProcessAsync_UpdateOutgoingShipment_NotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new UpdateOutgoingShipmentRequest
        {
            Id = Guid.NewGuid(),
            Data = OutgoingShipmentBuilder.BuildUpdateDto()
        };

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(dbContext.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Unscoped());

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task ProcessAsync_UpdateOutgoingShipment_VehicleNotFound()
    {
        var shipmentId = Guid.NewGuid();
        var outgoingShipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            state: OutgoingShipmentState.Created
        );

        var driver1Id = Guid.NewGuid();
        var driver1 = DriverBuilder.BuildEntity(publicId: driver1Id);

        var order1Id = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order1 = OrderBuilder.BuildEntity(publicId: order1Id, client: client);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            outgoingShipments: [outgoingShipment],
            drivers: [driver1],
            orders: [order1]
        );

        var command = new UpdateOutgoingShipmentRequest
        {
            Id = shipmentId,
            Data = OutgoingShipmentBuilder.BuildUpdateDto(
                vehicleId: Guid.NewGuid(), // Non-existent vehicle
                driverIds: [driver1Id],
                clientOrderShipments:
                [
                    new ClientOrderShipmentDto
                    {
                        ClientOrderId = order1Id,
                        Order = 1
                    }
                ]
            )
        };

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(dbContext.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Unscoped());

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task ProcessAsync_UpdateOutgoingShipment_DriverNotFound()
    {
        var shipmentId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var vehicle = VehicleBuilder.BuildEntity(publicId: vehicleId);

        var outgoingShipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            state: OutgoingShipmentState.Created
        );

        var order1Id = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order1 = OrderBuilder.BuildEntity(publicId: order1Id, client: client);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            outgoingShipments: [outgoingShipment],
            vehicles: [vehicle],
            orders: [order1]
        );

        var command = new UpdateOutgoingShipmentRequest
        {
            Id = shipmentId,
            Data = OutgoingShipmentBuilder.BuildUpdateDto(
                vehicleId: vehicleId,
                driverIds: [Guid.NewGuid()], // Non-existent driver
                clientOrderShipments:
                [
                    new ClientOrderShipmentDto
                    {
                        ClientOrderId = order1Id,
                        Order = 1
                    }
                ]
            )
        };

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(dbContext.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Unscoped());

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task ProcessAsync_UpdateOutgoingShipment_OrderNotFound()
    {
        var shipmentId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var vehicle = VehicleBuilder.BuildEntity(publicId: vehicleId);

        var driver1Id = Guid.NewGuid();
        var driver1 = DriverBuilder.BuildEntity(publicId: driver1Id);

        var outgoingShipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: shipmentId,
            state: OutgoingShipmentState.Created
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            outgoingShipments: [outgoingShipment],
            vehicles: [vehicle],
            drivers: [driver1]
        );

        var command = new UpdateOutgoingShipmentRequest
        {
            Id = shipmentId,
            Data = OutgoingShipmentBuilder.BuildUpdateDto(
                vehicleId: vehicleId,
                driverIds: [driver1Id],
                clientOrderShipments:
                [
                    new ClientOrderShipmentDto
                    {
                        ClientOrderId = Guid.NewGuid(), // Non-existent order
                        Order = 1
                    }
                ]
            )
        };

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(dbContext.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Unscoped());

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    // ---------------------------------------------------------------------------------
    // Content freeze and transition rules.
    //
    // A shipment's content is editable only in Created. From Loaded onward the state may
    // still advance — otherwise nothing could be delivered — and drivers, name and date
    // stay changeable, but what is on the truck is fixed.
    // ---------------------------------------------------------------------------------

    private sealed record FreezeFixture(
        OutgoingShipment Shipment, Order Order, Vehicle Vehicle, Driver Driver, Driver SpareDriver);

    /// <summary>
    /// A shipment that already satisfies <c>HasFilledData</c> — vehicle, driver, date and a
    /// stop — so the pre-existing "not prepared" check does not mask the guards under test.
    /// </summary>
    private static FreezeFixture BuildFreezeFixture(OutgoingShipmentState state)
    {
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(publicId: Guid.NewGuid(), client: client, state: OrderState.Planning);

        var vehicle = VehicleBuilder.BuildEntity(publicId: Guid.NewGuid());
        vehicle.Id = 21;

        var driver = DriverBuilder.BuildEntity(publicId: Guid.NewGuid());
        var spareDriver = DriverBuilder.BuildEntity(publicId: Guid.NewGuid());

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: Guid.NewGuid(),
            deliveryDate: DateTime.UtcNow.AddDays(1),
            state: state,
            vehicle: vehicle,
            drivers: [new OutgoingShipmentDriver { Driver = driver }],
            stops:
            [
                new OutgoingShipmentStop
                {
                    PublicId = Guid.NewGuid(),
                    Kind = OutgoingShipmentStopKind.Order,
                    Order = 1,
                    ClientOrder = order
                }
            ]);
        shipment.VehicleId = vehicle.Id;

        return new FreezeFixture(shipment, order, vehicle, driver, spareDriver);
    }

    /// <summary>
    /// The whole current content, as the UI re-sends it on every save.
    /// </summary>
    private static UpdateOutgoingShipmentDto EchoDto(FreezeFixture f, OutgoingShipmentState state) => new()
    {
        Name = "vyvoz",
        DeliveryDate = f.Shipment.DeliveryDate,
        VehicleId = f.Vehicle.PublicId,
        DriverIds = [f.Driver.PublicId],
        State = state,
        ClientOrderShipments =
        [
            new ClientOrderShipmentDto { ClientOrderId = f.Order.PublicId, Order = 1 }
        ]
    };

    private static Mock<AleTrack.Infrastructure.Persistence.AleTrackDbContext> MockForFreeze(FreezeFixture f)
    {
        var db = AleTrackDbContextMockFactory.CreateMock(
            outgoingShipments: [f.Shipment],
            orders: [f.Order],
            vehicles: [f.Vehicle],
            drivers: [f.Driver, f.SpareDriver]);
        db.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        return db;
    }

    [Fact]
    public async Task ProcessAsync_ChangeContentOfLoadedShipment_Fails()
    {
        var f = BuildFreezeFixture(OutgoingShipmentState.Loaded);
        var db = MockForFreeze(f);

        var data = EchoDto(f, OutgoingShipmentState.Loaded);
        data.ClientOrderShipments.Clear(); // drop the order off a packed truck

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(db.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Unscoped());

        var act = async () => await endpoint.HandleAsync(
            new UpdateOutgoingShipmentRequest { Id = f.Shipment.PublicId, Data = data }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.ShipmentContentFrozen);

        db.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        f.Shipment.Stops.Should().HaveCount(1, "the rejected request must not have touched the entity");
    }

    /// <summary>
    /// The advance() path — unchanged content, state stepped forward. This is what makes the
    /// freeze usable at all, so it is the case most worth guarding.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_AdvanceLoadedShipmentWithUnchangedContent_Success()
    {
        var f = BuildFreezeFixture(OutgoingShipmentState.Loaded);
        var db = MockForFreeze(f);

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(db.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Unscoped());

        await endpoint.HandleAsync(new UpdateOutgoingShipmentRequest
        {
            Id = f.Shipment.PublicId,
            Data = EchoDto(f, OutgoingShipmentState.InTransit)
        }, CancellationToken.None);

        f.Shipment.State.Should().Be(OutgoingShipmentState.InTransit);
        f.Order.State.Should().Be(OrderState.Delivering);
        db.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    /// <summary>
    /// Reverting out of Delivered re-ran the order transitions and freed already-delivered
    /// orders back to New, silently unwinding an invoiced, reported run.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_RevertDeliveredShipment_Fails()
    {
        var f = BuildFreezeFixture(OutgoingShipmentState.Delivered);
        f.Order.State = OrderState.Finished;
        var db = MockForFreeze(f);

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(db.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Unscoped());

        var act = async () => await endpoint.HandleAsync(new UpdateOutgoingShipmentRequest
        {
            Id = f.Shipment.PublicId,
            Data = EchoDto(f, OutgoingShipmentState.InTransit)
        }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.ShipmentTransitionNotAllowed);

        f.Shipment.State.Should().Be(OutgoingShipmentState.Delivered);
        f.Order.State.Should().Be(OrderState.Finished, "the delivered order must not be freed");
        db.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ProcessAsync_CancelDeliveredShipment_Fails()
    {
        var f = BuildFreezeFixture(OutgoingShipmentState.Delivered);
        f.Order.State = OrderState.Finished;
        var db = MockForFreeze(f);

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(db.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Unscoped());

        var act = async () => await endpoint.HandleAsync(new UpdateOutgoingShipmentRequest
        {
            Id = f.Shipment.PublicId,
            Data = EchoDto(f, OutgoingShipmentState.Cancelled)
        }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.ShipmentTransitionNotAllowed);

        f.Order.State.Should().Be(OrderState.Finished);
        db.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ProcessAsync_SkipFromCreatedStraightToDelivered_Fails()
    {
        var f = BuildFreezeFixture(OutgoingShipmentState.Created);
        var db = MockForFreeze(f);

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(db.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Unscoped());

        var act = async () => await endpoint.HandleAsync(new UpdateOutgoingShipmentRequest
        {
            Id = f.Shipment.PublicId,
            Data = EchoDto(f, OutgoingShipmentState.Delivered)
        }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.ShipmentTransitionNotAllowed);

        db.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    /// <summary>
    /// A cancelled run can be restored — the shipped affordance — and only to Created.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_RestoreCancelledShipment_Success()
    {
        var f = BuildFreezeFixture(OutgoingShipmentState.Cancelled);
        var db = MockForFreeze(f);

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(db.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Unscoped());

        await endpoint.HandleAsync(new UpdateOutgoingShipmentRequest
        {
            Id = f.Shipment.PublicId,
            Data = EchoDto(f, OutgoingShipmentState.Created)
        }, CancellationToken.None);

        f.Shipment.State.Should().Be(OutgoingShipmentState.Created);
        db.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    /// <summary>
    /// Drivers, name and delivery date carry no content, so they stay editable — a driver can
    /// be swapped and a date can slip on a packed truck.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_ChangeDriversNameAndDateOfLoadedShipment_Success()
    {
        var f = BuildFreezeFixture(OutgoingShipmentState.Loaded);
        var db = MockForFreeze(f);

        var newDate = DateTime.UtcNow.AddDays(4);
        var data = EchoDto(f, OutgoingShipmentState.Loaded);
        data.Name = "Přeplánovaný vývoz";
        data.DeliveryDate = newDate;
        data.DriverIds = [f.Driver.PublicId, f.SpareDriver.PublicId];

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(db.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Unscoped());

        await endpoint.HandleAsync(
            new UpdateOutgoingShipmentRequest { Id = f.Shipment.PublicId, Data = data }, CancellationToken.None);

        f.Shipment.Name.Should().Be("Přeplánovaný vývoz");
        f.Shipment.DeliveryDate.Should().Be(newDate);
        f.Shipment.Drivers.Should().HaveCount(2, "a driver can still be added to a packed truck");
        db.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    /// <summary>
    /// The snapshot is written at the same boundary that freezes content, which is what keeps the
    /// two from ever diverging.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_TransitionToLoaded_WritesTheContentSnapshot()
    {
        var f = BuildFreezeFixture(OutgoingShipmentState.Created);

        var product = ProductBuilder.BuildEntity(name: "Albrecht 12°", priceWithVat: 11.49m);
        product.Id = 41;
        product.Brewery = BreweryBuilder.BuildEntity(name: "Pivovar Zittau");
        f.Order.OrderItems =
        [
            new OrderItem { Id = 51, PublicId = Guid.NewGuid(), Product = product, ProductId = product.Id, Quantity = 6 }
        ];

        var db = MockForFreeze(f);
        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(db.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Unscoped());

        await endpoint.HandleAsync(new UpdateOutgoingShipmentRequest
        {
            Id = f.Shipment.PublicId,
            Data = EchoDto(f, OutgoingShipmentState.Loaded)
        }, CancellationToken.None);

        var stop = f.Shipment.Stops.Single(s => s.Kind == OutgoingShipmentStopKind.Order);
        var item = stop.Items.Should().ContainSingle().Subject;
        item.ProductName.Should().Be("Albrecht 12°");
        item.UnitPriceWithVat.Should().Be(11.49m);
        item.Quantity.Should().Be(6);
        item.BreweryName.Should().Be("Pivovar Zittau");
        stop.ClientName.Should().Be(f.Order.Client.Name);
    }

    /// <summary>
    /// Reverting reopens the content for editing, so the snapshot must go rather than go stale.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_RevertToCreated_DiscardsTheContentSnapshot()
    {
        var f = BuildFreezeFixture(OutgoingShipmentState.Loaded);
        var stop = f.Shipment.Stops.Single();
        stop.Items =
        [
            new OutgoingShipmentStopItem
            {
                PublicId = Guid.NewGuid(),
                ProductName = "Albrecht 12°",
                Quantity = 6,
                BreweryName = "Pivovar Zittau"
            }
        ];
        stop.ClientPublicId = Guid.NewGuid();
        stop.ClientName = "Hospoda U Kotvy";
        stop.ClientRegion = Region.ZittauCity;

        var db = MockForFreeze(f);
        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(db.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Unscoped());

        await endpoint.HandleAsync(new UpdateOutgoingShipmentRequest
        {
            Id = f.Shipment.PublicId,
            Data = EchoDto(f, OutgoingShipmentState.Created)
        }, CancellationToken.None);

        stop.Items.Should().BeEmpty();
        stop.ClientName.Should().BeNull();
        stop.ClientPublicId.Should().BeNull();
    }

    /// <summary>
    /// Advancing past Loaded must not re-snapshot. The source items are frozen by then, so
    /// re-running the writer would hand out new rows and new IDs for no reason.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_AdvanceLoadedToInTransit_LeavesTheSnapshotAlone()
    {
        var f = BuildFreezeFixture(OutgoingShipmentState.Loaded);
        var stop = f.Shipment.Stops.Single();
        var existing = new OutgoingShipmentStopItem
        {
            PublicId = Guid.NewGuid(),
            ProductName = "Albrecht 12°",
            Quantity = 6,
            BreweryName = "Pivovar Zittau"
        };
        stop.Items = [existing];

        var db = MockForFreeze(f);
        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(db.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Unscoped());

        await endpoint.HandleAsync(new UpdateOutgoingShipmentRequest
        {
            Id = f.Shipment.PublicId,
            Data = EchoDto(f, OutgoingShipmentState.InTransit)
        }, CancellationToken.None);

        stop.Items.Should().ContainSingle().Which.Should().BeSameAs(existing);
    }

    [Fact]
    public async Task ProcessAsync_ChangeVehicleOfLoadedShipment_Fails()
    {
        var f = BuildFreezeFixture(OutgoingShipmentState.Loaded);
        var otherVehicle = VehicleBuilder.BuildEntity(publicId: Guid.NewGuid());
        otherVehicle.Id = 22;

        var db = AleTrackDbContextMockFactory.CreateMock(
            outgoingShipments: [f.Shipment],
            orders: [f.Order],
            drivers: [f.Driver, f.SpareDriver],
            vehicles: [f.Vehicle, otherVehicle]);
        db.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var data = EchoDto(f, OutgoingShipmentState.Loaded);
        data.VehicleId = otherVehicle.PublicId;

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(db.Object, Options.Create(new CompanyOptions()), DriverScopeMockFactory.Unscoped());

        var act = async () => await endpoint.HandleAsync(
            new UpdateOutgoingShipmentRequest { Id = f.Shipment.PublicId, Data = data }, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.ErrorCode == ErrorCodes.ShipmentContentFrozen);

        db.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }
}
