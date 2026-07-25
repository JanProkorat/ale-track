using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Represents a note associated with a specific order (e.g. "dovézt dopoledne").
/// Inherits from the <see cref="Note"/> class and adds a reference to the
/// related order entity.
/// </summary>
[Table("order_notes")]
public sealed class OrderNote : Note
{
    /// <summary>
    /// ID of related <see cref="Entities.Order"/>
    /// </summary>
    [Column("order_id")]
    public long OrderId { get; set; }

    /// <summary>
    /// Date when the note was created.
    /// </summary>
    [Column("date_created")]
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// The parent <see cref="Entities.Order"/> related to this note.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public Order Order { get; set; } = null!;
}
