namespace AleTrack.Features.Notes.Commands.Create;

/// <summary>
/// Data transfer object used to create a note.
/// </summary>
public sealed record CreateNoteDto
{
    /// <summary>
    /// Text of the note
    /// </summary>
    public string Text { get; set; } = null!;
}
