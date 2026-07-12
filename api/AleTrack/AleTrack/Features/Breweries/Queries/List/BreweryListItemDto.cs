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
    /// Order in which the brewery should be displayed in tabs.
    /// </summary>
    public int DisplayOrder { get; set; }

    /// <summary>
    /// Represents the color associated with the brewery item.
    /// </summary>
    public string Color { get; set; } = null!;
}