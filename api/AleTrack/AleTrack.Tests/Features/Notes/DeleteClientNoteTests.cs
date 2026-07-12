using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Notes.Commands.Delete.Client;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Notes;

public sealed class DeleteClientNoteTests
{
    [Fact]
    public async Task ProcessAsync_DeleteClientNote_Success()
    {
        var noteId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(
            officialAddress: AddressBuilder.BuildEntity()
        );
        var note = NoteBuilder.BuildClientNoteEntity(
            publicId: noteId,
            text: "Note to be deleted",
            client: client
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(clientNotes: [note]);

        var command = new DeleteClientNoteRequest
        {
            Id = noteId
        };

        var endpoint = EndpointBuilder<DeleteClientNoteRequest, DeleteClientNoteEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        dbContext.Verify(e => e.ClientNotes.Remove(note), Times.Once);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_DeleteClientNote_NoteNotFound()
    {
        var nonExistentNoteId = Guid.NewGuid();
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new DeleteClientNoteRequest
        {
            Id = nonExistentNoteId
        };

        var endpoint = EndpointBuilder<DeleteClientNoteRequest, DeleteClientNoteEndpoint>.Create(dbContext.Object);

        var act = () => endpoint.HandleAsync(command, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
        
        dbContext.Verify(e => e.ClientNotes.Remove(It.IsAny<ClientNote>()), Times.Never);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }
}
