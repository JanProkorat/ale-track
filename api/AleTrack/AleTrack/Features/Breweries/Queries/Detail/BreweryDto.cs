using AleTrack.Common.Models;

namespace AleTrack.Features.Breweries.Queries.Detail;

/// <summary>
/// Represents a data transfer object (DTO) for a brewery.
/// </summary>
/// <remarks>
/// This class encapsulates the essential information about a brewery, including
/// its identifier, name, location details such as street name, street number,
/// city, zip code, and country.
/// </remarks>
public sealed record BreweryDto
{
    /// <summary>
    /// ID of the Brewery
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Name of the client
    /// </summary>
    public string Name { get; set; } = null!;
    
    /// <summary>
    /// Official address
    /// </summary>
    public AddressDto OfficialAddress { get; set; } = null!;
    
    /// <summary>
    /// Contact address
    /// </summary>
    public AddressDto? ContactAddress { get; set; }
}