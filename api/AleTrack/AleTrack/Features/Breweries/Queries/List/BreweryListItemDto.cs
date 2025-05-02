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
}