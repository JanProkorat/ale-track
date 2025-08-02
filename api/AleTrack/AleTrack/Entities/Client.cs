using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;

namespace AleTrack.Entities;

/// <summary>
/// Entity representing a client
/// </summary>
[Table("clients")]
public sealed class Client : PublicEntity
{
    /// <summary>
    /// Name of the client
    /// </summary>
    [MaxLength(50)]
    [Required]
    [Column("name")]
    public string Name { get; set; } = null!;
    
    /// <summary>
    /// Official address of the client
    /// </summary>
    public Address OfficialAddress { get; set; } = null!;

    /// <summary>
    /// Contact address of the client, which can be null
    /// </summary>
    public Address? ContactAddress { get; set; }
    
    /// <summary>
    /// List of orders from this client
    /// </summary>
    public ICollection<Order> Orders { get; set; } = [];
}