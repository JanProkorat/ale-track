using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Commands.Create;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.OutgoingShipments;

public sealed class CreateOutgoingShipmentTests
{
    [Fact]
    public async Task ProcessAsync_CreateOutgoingShipment_Success()
    {
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

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            vehicles: [vehicle],
            drivers: [driver1, driver2],
            orders: [order1, order2]
        );

        var deliveryDate = DateTime.UtcNow.AddDays(2);
        var command = new CreateOutgoingShipmentRequest
        {
            Data = OutgoingShipmentBuilder.BuildCreateDto(
                deliveryDate: deliveryDate,
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
                ]
            )
        };

        var endpoint = EndpointBuilder<CreateOutgoingShipmentRequest, CreateOutgoingShipmentEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        dbContext.Verify(e => e.OutgoingShipments.Add(It.Is<OutgoingShipment>(os =>
            os.DeliveryDate == deliveryDate &&
            os.State == OutgoingShipmentState.Created &&
            os.Vehicle == vehicle &&
            os.Drivers.Count == 2 &&
            os.Drivers.Any(d => d.Driver == driver1) &&
            os.Drivers.Any(d => d.Driver == driver2) &&
            os.Stops.Count == 2 &&
            os.Stops.Any(s => s.ClientOrder == order1 && s.Order == 1) &&
            os.Stops.Any(s => s.ClientOrder == order2 && s.Order == 2)
        )), Times.Once);

        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_CreateOutgoingShipment_VehicleNotFound()
    {
        var driver1Id = Guid.NewGuid();
        var driver1 = DriverBuilder.BuildEntity(publicId: driver1Id);

        var order1Id = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order1 = OrderBuilder.BuildEntity(publicId: order1Id, client: client);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            drivers: [driver1],
            orders: [order1]
        );

        var command = new CreateOutgoingShipmentRequest
        {
            Data = OutgoingShipmentBuilder.BuildCreateDto(
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

        var endpoint = EndpointBuilder<CreateOutgoingShipmentRequest, CreateOutgoingShipmentEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task ProcessAsync_CreateOutgoingShipment_DriverNotFound()
    {
        var vehicleId = Guid.NewGuid();
        var vehicle = VehicleBuilder.BuildEntity(publicId: vehicleId);

        var order1Id = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order1 = OrderBuilder.BuildEntity(publicId: order1Id, client: client);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            vehicles: [vehicle],
            orders: [order1]
        );

        var command = new CreateOutgoingShipmentRequest
        {
            Data = OutgoingShipmentBuilder.BuildCreateDto(
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

        var endpoint = EndpointBuilder<CreateOutgoingShipmentRequest, CreateOutgoingShipmentEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task ProcessAsync_CreateOutgoingShipment_OrderNotFound()
    {
        var vehicleId = Guid.NewGuid();
        var vehicle = VehicleBuilder.BuildEntity(publicId: vehicleId);

        var driver1Id = Guid.NewGuid();
        var driver1 = DriverBuilder.BuildEntity(publicId: driver1Id);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(
            vehicles: [vehicle],
            drivers: [driver1]
        );

        var command = new CreateOutgoingShipmentRequest
        {
            Data = OutgoingShipmentBuilder.BuildCreateDto(
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

        var endpoint = EndpointBuilder<CreateOutgoingShipmentRequest, CreateOutgoingShipmentEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
}
