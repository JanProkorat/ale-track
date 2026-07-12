using AleTrack.Common.Enums;
using AleTrack.Features.Products.Queries.List;

namespace AleTrack.Features.Products.Queries.ClientHistory;

/// <summary>
/// Represents a client's product order history, grouped by recency and brewery.
/// </summary>
public record GroupedProductHistoryDto
{
    /// <summary>
    /// Recently ordered products by the client.
    /// </summary>
    public List<ProductListItemDto> Recent { get; set; } = [];

    /// <summary>
    /// Products grouped by brewery.
    /// </summary>
    public List<BreweryGroupDto> Breweries { get; set; } = [];
}

/// <summary>
/// A group of products belonging to a single brewery, further categorized by product kind.
/// </summary>
public sealed record BreweryGroupDto
{
    /// <summary>
    /// Unique identifier of the brewery.
    /// </summary>
    public Guid BreweryId { get; set; }

    /// <summary>
    /// Display name of the brewery.
    /// </summary>
    public string BreweryName { get; set; } = null!;

    /// <summary>
    /// Products grouped by their kind (e.g. beer, cider).
    /// </summary>
    public List<KindGroupDto> Kinds { get; set; } = [];
}

/// <summary>
/// A group of products of the same kind, further categorized by package size.
/// </summary>
public sealed record KindGroupDto
{
    /// <summary>
    /// The product kind (e.g. beer, cider, lemonade).
    /// </summary>
    public ProductKind Kind { get; set; }

    /// <summary>
    /// Products grouped by their package size.
    /// </summary>
    public List<PackageGroupDto> PackageSizes { get; set; } = [];
}

/// <summary>
/// A group of products sharing the same package size.
/// </summary>
public sealed record PackageGroupDto
{
    /// <summary>
    /// The package size in liters, or <c>null</c> if not applicable.
    /// </summary>
    public double? Size { get; set; }

    /// <summary>
    /// Products with this package size.
    /// </summary>
    public List<ProductListItemDto> Items { get; set; } = [];
}
