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
    /// Name of related country
    /// </summary>
    public string Country { get; set; } = null!;
}