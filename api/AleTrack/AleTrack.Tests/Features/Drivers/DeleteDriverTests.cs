using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Drivers.Commands.Delete;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Drivers;

public sealed class DeleteDriverTests
{
    [Fact]
    public async Task ProcessAsync_DeleteDriver_Success()
    {
        var driverId = Guid.NewGuid();
        var driver = DriverBuilder.BuildEntity(publicId: driverId);
        
        var dbContext = AleTrackDbContextMockFactory.CreateMock(drivers: [driver]);

        var command = new DeleteDriverRequest
        {
            Id = driverId
        };

        var endpoint = EndpointBuilder<DeleteDriverRequest, DeleteDriverEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        dbContext.Verify(e => e.Drivers.Remove(It.IsAny<Driver>()), Times.Once);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
    
    [Fact]
    public async Task ProcessAsync_DeleteDriver_NotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new DeleteDriverRequest
        {
            Id = Guid.NewGuid()
        };

        var endpoint = EndpointBuilder<DeleteDriverRequest, DeleteDriverEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);
        
        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
}
