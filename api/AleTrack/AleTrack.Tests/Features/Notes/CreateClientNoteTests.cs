using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Notes.Commands.Create.Client;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Notes;

public sealed class CreateClientNoteTests
{
    [Fact]
    public async Task ProcessAsync_CreateClientNote_Success()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(
            publicId: clientId,
            officialAddress: AddressBuilder.BuildEntity()
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client]);
        
        var command = new CreateClientNoteRequest
        {
            Id = clientId,
            Data = NoteBuilder.BuildCreateDto("Test note content")
        };

        var endpoint = EndpointBuilder<CreateClientNoteRequest, CreateClientNoteEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);
        
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        
        client.Notes.Count.Should().Be(1);
        client.Notes[0].Text.Should().Be(command.Data.Text);
    }

    [Fact]
    public async Task ProcessAsync_CreateClientNote_ClientNotFound()
    {
        var nonExistentClientId = Guid.NewGuid();
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new CreateClientNoteRequest
        {
            Id = nonExistentClientId,
            Data = NoteBuilder.BuildCreateDto("Test note content")
        };

        var endpoint = EndpointBuilder<CreateClientNoteRequest, CreateClientNoteEndpoint>.Create(dbContext.Object);

        var act = () => endpoint.HandleAsync(command, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
        
        dbContext.Verify(e => e.ClientNotes.Add(It.IsAny<ClientNote>()), Times.Never);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }
}
