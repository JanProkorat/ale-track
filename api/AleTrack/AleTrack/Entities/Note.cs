using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;

namespace AleTrack.Entities;

/// <summary>
/// Entity representing a note
/// </summary>
public abstract class Note : PublicEntity
{
    /// <summary>
    /// Text of note
    /// </summary>
    [Required]
    [MaxLength(1000)]
    [Column("text")]
    public string Text { get; set; } = null!;
}