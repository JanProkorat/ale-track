using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;

namespace AleTrack.Entities;

/// <summary>
/// Represents a vehicle entity that inherits from the PublicEntity class.
/// This class is sealed and defines properties specific to a vehicle.
/// </summary>
[Table("vehicles")]
public sealed class Vehicle : PublicEntity
{
    /// <summary>
    /// Name of the vehicle
    /// </summary>
    [Required]
    [MaxLength(50)]
    [Column("name")]
    public string Name { get; set; } = null!;
    
    /// <summary>
    /// Max weight that the vehicle can carry
    /// </summary>
    [Column("max_weight")]
    public double MaxWeight { get; set; }
}