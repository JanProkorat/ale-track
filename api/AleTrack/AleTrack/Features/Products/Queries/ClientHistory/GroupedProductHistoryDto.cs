using AleTrack.Common.Enums;
using AleTrack.Features.Products.Queries.List;

namespace AleTrack.Features.Products.Queries.ClientHistory;

public record GroupedProductHistoryDto
{
    public List<ProductListItemDto> Recent { get; set; } = [];
    public List<BreweryGroupDto> Breweries { get; set; } = [];
}

public sealed record BreweryGroupDto
{
    public Guid BreweryId { get; set; }
    public string BreweryName { get; set; } = null!;
    public List<KindGroupDto> Kinds { get; set; } = [];
}

public sealed record KindGroupDto
{
    public ProductKind Kind { get; set; }
    public List<PackageGroupDto> PackageSizes { get; set; } = [];
}

public sealed record PackageGroupDto
{
    public double? Size { get; set; }
    public List<ProductListItemDto> Items { get; set; } = [];
}