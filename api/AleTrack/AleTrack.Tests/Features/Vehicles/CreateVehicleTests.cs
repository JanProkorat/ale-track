using AleTrack.Entities;
using AleTrack.Features.Vehicles.Commands.Create;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using Moq;

namespace AleTrack.Tests.Features.Vehicles;

public sealed class CreateVehicleTests
{
    [Fact]
    public async Task ProcessAsync_CreateVehicle_Success()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();
        
        var command = new CreateVehicleRequest
        {
            Data = VehicleBuilder.BuildCreateDto(
                name: "Test Truck",
                maxWeight: 3500.0
            )
        };

        var endpoint = EndpointBuilder<CreateVehicleRequest, CreateVehicleEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);
        
        dbContext.Verify(e => e.Vehicles.Add(It.Is<Vehicle>(v => 
            v.Name == command.Data.Name &&
            Math.Abs(v.MaxWeight - command.Data.MaxWeight) < 0.001
        )), Times.Once);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
