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

    /// <summary>
    /// Phone number of the driver
    /// </summary>
    [MaxLength(20)]
    [Column("phone_number")]
    public string? PhoneNumber { get; set; }

    /// <summary>
    /// Color of the driver in the calendar - hexa code
    /// </summary>
    [MaxLength(20)]
    [Column("color")]
    public string Color { get; set; } = null!;
    
    /// <summary>
    /// List of deliveries which the current user is related to
    /// </summary>
    public ICollection<ProductDelivery> Deliveries { get; set; } = [];
    
    /// <summary>
    /// Dates when the driver is available
    /// </summary>
    public ICollection<DriverAvailability> Availabilities { get; set; } = [];
}