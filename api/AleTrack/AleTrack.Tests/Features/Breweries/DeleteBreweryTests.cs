using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Breweries.Commands.Delete;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Breweries;

public sealed class DeleteBreweryTests
{
    [Fact]
    public async Task ProcessAsync_DeleteBrewery_Success()
    {
        var breweryId = Guid.NewGuid();
        var brewery = BreweryBuilder.BuildEntity(
            publicId: breweryId,
            officialAddress: AddressBuilder.BuildEntity()
        );
        
        var dbContext = AleTrackDbContextMockFactory.CreateMock(breweries: [brewery]);

        var command = new DeleteBreweryRequest
        {
            Id = breweryId
        };

        var endpoint = EndpointBuilder<DeleteBreweryRequest, DeleteBreweryEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        dbContext.Verify(e => e.Breweries.Remove(It.IsAny<Brewery>()), Times.Once);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
    
    [Fact]
    public async Task ProcessAsync_DeleteBrewery_NotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new DeleteBreweryRequest
        {
            Id = Guid.NewGuid()
        };

        var endpoint = EndpointBuilder<DeleteBreweryRequest, DeleteBreweryEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);
        
        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
}
