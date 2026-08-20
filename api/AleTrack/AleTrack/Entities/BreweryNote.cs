using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Represents a note associated with a specific brewery.
/// Inherits from the <see cref="Note"/> class and adds a reference
/// to the related brewery entity.
/// </summary>
[Table("brewery_notes")]
public sealed class BreweryNote : Note
{
    /// <summary>
    /// ID of related <see cref="Brewery"/>
    /// </summary>
    [Column("brewery_id")]
    public long BreweryId { get; set; }

    /// <summary>
    /// Date when the note was created.
    /// </summary>
    [Column("date_created")]
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// The parent <see cref="Brewery"/> related to this note.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public Brewery Brewery { get; set; } = null!;
}
