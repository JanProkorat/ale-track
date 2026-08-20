using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Represents a note associated with a specific supplier. Mirrors <see cref="ClientNote"/>.
/// </summary>
[Table("supplier_notes")]
public sealed class SupplierNote : Note
{
    /// <summary>
    /// ID of related <see cref="Supplier"/>
    /// </summary>
    [Column("supplier_id")]
    public long SupplierId { get; set; }

    /// <summary>
    /// Date when the note was created.
    /// </summary>
    [Column("date_created")]
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// The parent <see cref="Supplier"/> related to this note.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public Supplier Supplier { get; set; } = null!;
}
