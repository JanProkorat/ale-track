using AleTrack.Common.Enums;

namespace AleTrack.Features.Breweries.Queries.List;

/// <summary>
/// Represents a simplified brewery item used in list outputs.
/// </summary>
public sealed record BreweryListItemDto
{
    /// <summary>
    /// Unique identifier of the brewery.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Name of the brewery.
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
    public Country Country { get; set; }
}