using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AleTrack.Entities.BaseEntities;

/// <summary>
/// Base entity containing address information
/// </summary>
public class LocationEntity : PublicEntity
{
    /// <summary>
    /// Name of the street
    /// </summary>
    [MaxLength(50)]
    [Required]
    [Column("street_name")]
    public string StreetName { get; set; } = null!;
    
    /// <summary>
    /// Street number
    /// </summary>
    [MaxLength(50)]
    [Required]
    [Column("street_number")]
    public string StreetNumber { get; set; } = null!;
    
    /// <summary>
    /// Name of the city
    /// </summary>
    [MaxLength(50)]
    [Required]
    [Column("city")]
    public string City { get; set; } = null!;
    
    /// <summary>
    /// Zip code
    /// </summary>
    [MaxLength(10)]
    [Required]
    [Column("zip")]
    public string Zip { get; set; } = null!;
    
    /// <summary>
    /// Name of related country
    /// </summary>
    [MaxLength(50)]
    [Required]
    [Column("country")]
    public string Country { get; set; } = null!;
}