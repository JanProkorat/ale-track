using AleTrack.Common.Enums;

namespace AleTrack.Common.Models;

/// <summary>
/// Data about address
/// </summary>
public sealed record AddressDto
{
    /// <summary>
    /// Name of the street
    /// </summary>
    public string StreetName { get; set; } = null!;
    
    /// <summary>
    /// Street number
    /// </summary>
    public string StreetNumber { get; set; } = null!;
    
    /// <summary>
    /// Name of the city
    /// </summary>
    public string City { get; set; } = null!;
    
    /// <summary>
    /// Zip code
    /// </summary>
    public string Zip { get; set; } = null!;
    
    /// <summary>
    /// Related country
    /// </summary>
    public Country Country { get; set; }

    /// <summary>
    /// Latitude related to this address
    /// </summary>
    public decimal? Latitude { get; set; }

    /// <summary>
    /// Longitude related to this address
    /// </summary>
    public decimal? Longitude { get; set; }
}