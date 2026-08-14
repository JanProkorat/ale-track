using AleTrack.Common.Enums;

namespace AleTrack.Features.Sales.Queries.Detail;

/// <summary>
/// One line of a garage sale as returned to the client.
/// </summary>
/// <remarks>
/// Every descriptive field is the snapshot taken when the line was sold, not a live join, so the row
/// reads the same after the product is retired or the ceník moves.
/// </remarks>
public sealed record SaleItemDetailDto
{
    /// <summary>
    /// Public ID of the line.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Public ID of the stock row the pieces came from. Null once that row is gone.
    /// </summary>
    public Guid? InventoryItemId { get; set; }

    /// <summary>
    /// Item name as it was when sold.
    /// </summary>
    public string Name { get; set; } = null!;

    /// <summary>
    /// Packaging as it was when sold. Null for a free-form stock item.
    /// </summary>
    public ProductKind? Kind { get; set; }

    /// <summary>
    /// Container volume in litres as it was when sold.
    /// </summary>
    public double? PackageSize { get; set; }

    /// <summary>
    /// Pieces sold.
    /// </summary>
    public int Quantity { get; set; }

    /// <summary>
    /// Price per piece with VAT actually charged.
    /// </summary>
    public decimal UnitPriceWithVat { get; set; }

    /// <summary>
    /// Ceník price per piece with VAT at the time of sale. Null for a free-form stock item.
    /// </summary>
    public decimal? ListPriceWithVat { get; set; }

    /// <summary>
    /// Free-form note about this line.
    /// </summary>
    public string? Note { get; set; }
}
