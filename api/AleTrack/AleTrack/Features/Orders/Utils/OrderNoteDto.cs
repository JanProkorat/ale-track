namespace AleTrack.Features.Orders.Utils;

/// <summary>
/// A free-form note on an order. Used for both read and write —
/// <see cref="Id"/> is set on read and on updates of an existing note, and null
/// for newly-added ones.
/// </summary>
public sealed record OrderNoteDto
{
    /// <summary>Public ID of the note (null when newly added).</summary>
    public Guid? Id { get; set; }

    /// <summary>Text of the note.</summary>
    public string Text { get; set; } = null!;

    /// <summary>When the note was first written. Server-assigned; ignored on write.</summary>
    public DateTime? DateCreated { get; set; }
}
