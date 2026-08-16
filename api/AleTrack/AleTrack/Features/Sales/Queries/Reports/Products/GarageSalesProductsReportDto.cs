using AleTrack.Common.Enums;

namespace AleTrack.Features.Sales.Queries.Reports.Products;

/// <summary>
/// What moved off the shelf over a window, what it was discounted by, and what is still sitting
/// in the warehouse.
/// </summary>
public sealed record GarageSalesProductsReportDto
{
    /// <summary>Every sold item with volume, highest revenue first. The frontend slices its top N.</summary>
    public List<ProductSalesRowDto> TopProducts { get; set; } = [];

    /// <summary>Sud / basa / plechovka breakdown, highest revenue first.</summary>
    public List<SalesByKindDto> ByKind { get; set; } = [];

    /// <summary>Total given away against the ceník price, with VAT.</summary>
    public decimal DiscountTotal { get; set; }

    /// <summary>
    /// Discount as a share of what the same goods would have cost at list price, 0–1. Zero when
    /// nothing with a list price was sold.
    /// </summary>
    public double DiscountedRevenueShare { get; set; }

    /// <summary>
    /// Every stock row with pieces on hand, slowest first — never-sold rows lead, then the
    /// longest cover. Named for what it measures rather than for the dead stock at its head:
    /// rows that did sell are what give the list its days-of-cover column.
    /// </summary>
    public List<StockCoverageRowDto> StockCoverage { get; set; } = [];
}

/// <summary>One product's sales over the window.</summary>
public sealed record ProductSalesRowDto
{
    /// <summary>
    /// Public id of the product, null for a free-form stock item (or one hard-deleted since).
    /// </summary>
    public Guid? ProductId { get; set; }

    /// <summary>Name as snapshotted on the sold line.</summary>
    public string Name { get; set; } = null!;

    /// <summary>Packaging as snapshotted on the sold line. Null for a free-form item.</summary>
    public ProductKind? Kind { get; set; }

    public int Units { get; set; }
    public double Litres { get; set; }
    public decimal Revenue { get; set; }

    /// <summary>Given away against the line's snapshotted ceník price.</summary>
    public decimal DiscountTotal { get; set; }
}

/// <summary>Sales rolled up by packaging.</summary>
public sealed record SalesByKindDto
{
    /// <summary>Null groups every free-form item that has no packaging.</summary>
    public ProductKind? Kind { get; set; }

    public int Units { get; set; }
    public double Litres { get; set; }
    public decimal Revenue { get; set; }
}

/// <summary>One stock row against how fast it is selling.</summary>
public sealed record StockCoverageRowDto
{
    /// <summary>Public id of the inventory row.</summary>
    public Guid InventoryItemId { get; set; }

    public string Name { get; set; } = null!;

    /// <summary>Pieces on hand right now — a live value, not a historical one.</summary>
    public int Quantity { get; set; }

    /// <summary>Pieces sold from this stock row inside the window.</summary>
    public int UnitsSold { get; set; }

    /// <summary>
    /// How long the current quantity lasts at the window's sales rate. Null when nothing sold —
    /// "never sold" is a different fact from "a very long cover", and must not be shown as one.
    /// </summary>
    public double? DaysOfCover { get; set; }
}
