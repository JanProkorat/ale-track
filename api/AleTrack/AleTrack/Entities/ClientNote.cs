using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Represents a note associated with a specific client.
/// Inherits from the <see cref="Note"/> class and adds a reference
/// to the related client entity.
/// </summary>
[Table("client_notes")]
public sealed class ClientNote : Note
{
    /// <summary>
    /// ID of related <see cref="Client"/>
    /// </summary>
    [Column("client_id")]
    public long ClientId { get; set; }
    
    /// <summary>
    /// Date when the note was created.
    /// </summary>
    [Column("date_created")]
    public DateTime DateCreated { get; set; }
    
    /// <summary>
    /// The parent <see cref="Client"/> related to this note.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public Client Client { get; set; } = null!;
}