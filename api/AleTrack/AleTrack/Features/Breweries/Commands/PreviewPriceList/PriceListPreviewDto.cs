using AleTrack.Common.Enums;
using AleTrack.Features.Products.Import;

namespace AleTrack.Features.Breweries.Commands.PreviewPriceList;

/// <summary>
/// What applying an uploaded price list would do.
/// </summary>
public sealed record PriceListPreviewDto
{
    /// <summary>
    /// Identity of the reviewed file. The apply call sends it back and is refused if the file it
    /// carries no longer hashes to this.
    /// </summary>
    public required string SourceHash { get; init; }

    /// <summary>Date the list takes effect, as given with the upload.</summary>
    public required DateOnly EffectiveFrom { get; init; }

    /// <summary>Where the file says it came from, when it carries a source line.</summary>
    public string? SourceName { get; init; }

    /// <summary>Brewery whose catalogue the list was compared against.</summary>
    public required string BreweryName { get; init; }

    /// <summary>How many products fall into each bucket.</summary>
    public required PriceListPreviewSummaryDto Summary { get; init; }

    /// <summary>One entry per row of the list, plus one per stored product the list omits.</summary>
    public required List<PriceListPreviewItemDto> Items { get; init; }
}

/// <summary>
/// Bucket totals, so the UI can lead with the shape of the import.
/// </summary>
/// <param name="Added">Products the list introduces.</param>
/// <param name="Repriced">Products whose prices alone move.</param>
/// <param name="Changed">Products where something other than price moves.</param>
/// <param name="Unchanged">Products the list confirms as they are.</param>
/// <param name="ToRemove">Products the list omits, which may be removed.</param>
/// <param name="Blocked">Products the list omits but which are in use, and are kept.</param>
public sealed record PriceListPreviewSummaryDto(
    int Added, int Repriced, int Changed, int Unchanged, int ToRemove, int Blocked);

/// <summary>
/// One product's place in the import.
/// </summary>
public sealed record PriceListPreviewItemDto
{
    /// <summary>Which bucket this product falls into.</summary>
    public required PriceListChangeKind Kind { get; init; }

    /// <summary>Product name.</summary>
    public required string Name { get; init; }

    /// <summary>Public ID of the stored product, when one matched.</summary>
    public Guid? ProductId { get; init; }

    /// <summary>The vessel the drink is in.</summary>
    public required ProductContainer Container { get; init; }

    /// <summary>What one sellable unit is.</summary>
    public required ProductSaleUnit SaleUnit { get; init; }

    /// <summary>Volume of one container, in litres.</summary>
    public double? VolumeLiters { get; init; }

    /// <summary>Containers per sellable unit.</summary>
    public required int UnitsPerPackage { get; init; }

    /// <summary>Price of one sellable unit with VAT, as the list states it.</summary>
    public decimal? PriceWithVat { get; init; }

    /// <summary>
    /// Which of this row's prices the parser computed rather than read. Worth showing: a derived
    /// figure can differ from the printed one by a haléř.
    /// </summary>
    public required PriceDerivation Derived { get; init; }

    /// <summary>Fields this import would change.</summary>
    public required List<PriceListFieldChange> Changes { get; init; }
}
