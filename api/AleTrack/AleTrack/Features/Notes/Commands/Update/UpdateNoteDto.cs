namespace AleTrack.Features.Notes.Commands.Update;

/// <summary>
/// Data transfer object used to update a note.
/// </summary>
public sealed record UpdateNoteDto
{
    /// <summary>
    /// Text of the note
    /// </summary>
    public string Text { get; set; } = null!;
}
