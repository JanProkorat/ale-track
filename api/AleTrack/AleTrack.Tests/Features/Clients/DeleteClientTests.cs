using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Clients.Commands.Delete;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Clients;

public sealed class DeleteClientTests
{
    [Fact]
    public async Task ProcessAsync_DeleteClient_Success()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(
            publicId: clientId,
            officialAddress: AddressBuilder.BuildEntity()
        );
        
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client]);

        var command = new DeleteClientRequest
        {
            Id = clientId
        };

        var endpoint = EndpointBuilder<DeleteClientRequest, DeleteClientEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        dbContext.Verify(e => e.SoftlyDelete(It.IsAny<Client>()), Times.Once);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
    
    [Fact]
    public async Task ProcessAsync_DeleteClient_NotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new DeleteClientRequest
        {
            Id = Guid.NewGuid()
        };

        var endpoint = EndpointBuilder<DeleteClientRequest, DeleteClientEndpoint>.Create(dbContext.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);
        
        // Assert
        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
}

