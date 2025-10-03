namespace AleTrack.Features.Notes.Queries.List;

public sealed record NoteDto
{
    /// <summary>
    /// Id of the note
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Text of the note
    /// </summary>
    public string Text { get; set; } = null!;
}