using AleTrack.Common.Enums;

namespace AleTrack.Features.Products.Import;

/// <summary>
/// A brewery price list, parsed. The one shape both the seeded catalogue files and an uploaded
/// price list are read into, so the two cannot diverge.
/// </summary>
/// <param name="Brewery">Brewery name from the file's metadata, when it carries any.</param>
/// <param name="EffectiveFrom">Date the list takes effect, when the file states it.</param>
/// <param name="Source">Where the file was transcribed from.</param>
/// <param name="Rows">One row per sellable product.</param>
public sealed record PriceListCatalog(
    string? Brewery,
    DateOnly? EffectiveFrom,
    string? Source,
    List<PriceListRow> Rows);

/// <summary>
/// One priced product from a price list.
/// </summary>
public sealed record PriceListRow
{
    /// <summary>
    /// The product's public identity, when the file names one; <c>null</c> when the cell is blank
    /// or the column absent, which means "mint one on the way in".
    /// </summary>
    /// <remarks>
    /// Optional because only some lists carry it: the Rohozec seed file pins its ids so re-seeding
    /// does not hand every product a new identity, while an uploaded brewery list has none to give.
    /// Parsing stays deterministic — generating here would hand preview and apply two different ids
    /// for the same file.
    /// </remarks>
    public Guid? PublicId { get; init; }

    /// <summary>Product name, as printed.</summary>
    public required string Name { get; init; }

    /// <summary>Beer style.</summary>
    public required ProductType Type { get; init; }

    /// <summary>The vessel the drink is in.</summary>
    public required ProductContainer Container { get; init; }

    /// <summary>What one sellable unit is.</summary>
    public required ProductSaleUnit SaleUnit { get; init; }

    /// <summary>Volume of one container, in litres.</summary>
    public double? VolumeLiters { get; init; }

    /// <summary>Containers per sellable unit.</summary>
    public required int UnitsPerPackage { get; init; }

    /// <summary>Alcohol by volume, in percent.</summary>
    public float? AlcoholPercentage { get; init; }

    /// <summary>Degree (stupňovitost).</summary>
    public float? PlatoDegree { get; init; }

    /// <summary>Price of one container, without VAT.</summary>
    public decimal? UnitPriceWithoutVat { get; init; }

    /// <summary>Price of one container, with VAT.</summary>
    public decimal? UnitPriceWithVat { get; init; }

    /// <summary>Price of one sellable unit, without VAT.</summary>
    public decimal? PackPriceWithoutVat { get; init; }

    /// <summary>Price of one sellable unit, with VAT. The one price every list prints.</summary>
    public required decimal PackPriceWithVat { get; init; }

    /// <summary>
    /// Which prices were computed rather than printed. The lists round per-container and per-unit
    /// independently, so a derived figure can differ from a printed one by a haléř — worth showing
    /// in an import preview rather than presenting as though it came off the page.
    /// </summary>
    public required PriceDerivation Derived { get; init; }

    /// <summary>Line number in the source file, for error reporting.</summary>
    public required int Line { get; init; }
}

/// <summary>
/// Prices that were computed rather than read.
/// </summary>
[Flags]
public enum PriceDerivation
{
    /// <summary>Every price came off the page.</summary>
    None = 0,

    /// <summary>Per-container price computed from the unit price.</summary>
    UnitPrice = 1,

    /// <summary>Sellable-unit price computed from the per-container price.</summary>
    PackPrice = 2,

    /// <summary>A without-VAT price computed from its with-VAT counterpart.</summary>
    WithoutVat = 4
}
