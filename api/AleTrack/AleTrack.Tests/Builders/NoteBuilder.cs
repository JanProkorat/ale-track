using AleTrack.Entities;
using AleTrack.Features.Notes.Commands.Create;
using AleTrack.Features.Notes.Commands.Update;

namespace AleTrack.Tests.Builders;

/// <summary>
/// Builder class for creating Note entities and DTOs for testing purposes.
/// </summary>
public static class NoteBuilder
{
    /// <summary>
    /// Builds a CreateNoteDto with the specified text.
    /// </summary>
    public static CreateNoteDto BuildCreateDto(string text = "Test note text")
    {
        return new CreateNoteDto
        {
            Text = text
        };
    }

    /// <summary>
    /// Builds an UpdateNoteDto with the specified text.
    /// </summary>
    public static UpdateNoteDto BuildUpdateDto(string text = "Updated note text")
    {
        return new UpdateNoteDto
        {
            Text = text
        };
    }

    /// <summary>
    /// Builds a ClientNote entity with the specified parameters.
    /// </summary>
    public static ClientNote BuildClientNoteEntity(
        Guid? publicId = null,
        string text = "Test note text",
        Client? client = null,
        long? clientId = null)
    {
        return new ClientNote
        {
            PublicId = publicId ?? Guid.NewGuid(),
            Text = text,
            Client = client ?? ClientBuilder.BuildEntity(),
            ClientId = clientId ?? 1
        };
    }
}
