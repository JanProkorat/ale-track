using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Base entity containing address information
/// </summary>
[Owned]
public class Address
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
    /// Related country
    /// </summary>
    [Required]
    [Column("country")]
    public Country Country { get; set; }

    /// <summary>
    /// Latitude related to this address
    /// </summary>
    [Column("latitude")]
    public decimal? Latitude { get; set; }

    /// <summary>
    /// Longitude related to this address
    /// </summary>
    [Column("longitude")]
    public decimal? Longitude { get; set; }
}