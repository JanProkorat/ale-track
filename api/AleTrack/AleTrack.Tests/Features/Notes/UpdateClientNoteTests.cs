using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Notes.Commands.Update.Client;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Notes;

public sealed class UpdateClientNoteTests
{
    [Fact]
    public async Task ProcessAsync_UpdateClientNote_Success()
    {
        var noteId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(
            officialAddress: AddressBuilder.BuildEntity()
        );
        var note = NoteBuilder.BuildClientNoteEntity(
            publicId: noteId,
            text: "Original note text",
            client: client
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(clientNotes: [note]);

        var command = new UpdateClientNoteRequest
        {
            Id = noteId,
            Data = NoteBuilder.BuildUpdateDto("Updated note content")
        };

        var endpoint = EndpointBuilder<UpdateClientNoteRequest, UpdateClientNoteEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        note.Text.Should().Be("Updated note content");
        dbContext.Verify(e => e.ClientNotes.Update(note), Times.Once);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_UpdateClientNote_NoteNotFound()
    {
        var nonExistentNoteId = Guid.NewGuid();
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new UpdateClientNoteRequest
        {
            Id = nonExistentNoteId,
            Data = NoteBuilder.BuildUpdateDto("Updated note content")
        };

        var endpoint = EndpointBuilder<UpdateClientNoteRequest, UpdateClientNoteEndpoint>.Create(dbContext.Object);

        var act = () => endpoint.HandleAsync(command, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
        
        dbContext.Verify(e => e.ClientNotes.Update(It.IsAny<ClientNote>()), Times.Never);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }
}
