using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;

namespace AleTrack.Entities;

/// <summary>
/// Represents a driver entity that inherits from the PublicEntity class.
/// The Driver class is used to store information about individual drivers, specifically their first and last names.
/// </summary>
[Table("drivers")]
public sealed class Driver : PublicEntity
{
    /// <summary>
    /// First name of the driver
    /// </summary>
    [MaxLength(20)]
    [Required]
    [Column("first_name")]
    public string FirstName { get; set; } = null!;
    
    /// <summary>
    /// Last name of the driver
    /// </summary>
    [MaxLength(20)]
    [Required]
    [Column("last_name")]
    public string LastName { get; set; } = null!;
}