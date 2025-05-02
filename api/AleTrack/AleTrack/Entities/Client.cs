using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;

namespace AleTrack.Entities;

/// <summary>
/// Entity representing a client
/// </summary>
[Table("clients")]
public sealed class Client : LocationEntity
{
    /// <summary>
    /// Name of the client
    /// </summary>
    [MaxLength(50)]
    [Required]
    [Column("name")]
    public string Name { get; set; } = null!;
    
    /// <summary>
    /// List of orders from this client
    /// </summary>
    public ICollection<Order> Orders { get; set; } = [];
}