using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Features.Vehicles.Commands.Update;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Vehicles;

public sealed class UpdateVehicleTests
{
    [Fact]
    public async Task ProcessAsync_UpdateVehicle_Success()
    {
        var vehicleId = Guid.NewGuid();
        var vehicle = VehicleBuilder.BuildEntity(
            publicId: vehicleId,
            name: "Old Vehicle",
            maxWeight: 1000.0
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(vehicles: [vehicle]);

        var command = new UpdateVehicleRequest
        {
            Id = vehicleId,
            Data = VehicleBuilder.BuildUpdateDto(
                name: "Updated Vehicle Name",
                maxWeight: 3000.0
            )
        };

        var endpoint = EndpointBuilder<UpdateVehicleRequest, UpdateVehicleEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        // Verify that the vehicle entity was updated with correct values
        vehicle.Name.Should().Be(command.Data.Name);
        vehicle.MaxWeight.Should().Be(command.Data.MaxWeight);
        
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
    
    [Fact]
    public async Task ProcessAsync_UpdateVehicle_NotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new UpdateVehicleRequest
        {
            Id = Guid.NewGuid(),
            Data = VehicleBuilder.BuildUpdateDto()
        };

        var endpoint = EndpointBuilder<UpdateVehicleRequest, UpdateVehicleEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);
        
        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
}
