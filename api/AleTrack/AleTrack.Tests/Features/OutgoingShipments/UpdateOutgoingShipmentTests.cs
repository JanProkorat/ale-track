using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Commands.Update;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
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

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(dbContext.Object);
        
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
    public async Task ProcessAsync_UpdateOutgoingShipment_NotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new UpdateOutgoingShipmentRequest
        {
            Id = Guid.NewGuid(),
            Data = OutgoingShipmentBuilder.BuildUpdateDto()
        };

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(dbContext.Object);

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

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(dbContext.Object);

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

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(dbContext.Object);

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

        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
}
