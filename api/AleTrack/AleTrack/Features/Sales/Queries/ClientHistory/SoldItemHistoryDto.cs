namespace AleTrack.Features.Sales.Queries.ClientHistory;

/// <summary>
/// One stock item a client has bought before, offered as a quick-add suggestion in the sale editor.
/// </summary>
public sealed record SoldItemHistoryDto
{
    /// <summary>
    /// Public ID of the inventory item the pieces came from.
    /// </summary>
    public Guid InventoryItemId { get; set; }

    /// <summary>
    /// Item name as recorded on the most recent sale of it.
    /// </summary>
    public string Name { get; set; } = null!;

    /// <summary>
    /// Container volume in litres as recorded on the most recent sale of it.
    /// </summary>
    public double? PackageSize { get; set; }

    /// <summary>
    /// Date the client last bought this item.
    /// </summary>
    public DateOnly LastSoldDate { get; set; }

    /// <summary>
    /// Price per piece with VAT charged the last time.
    /// </summary>
    public decimal LastUnitPriceWithVat { get; set; }

    /// <summary>
    /// Pieces bought the last time, so a repeat order can start from the usual amount.
    /// </summary>
    public int LastQuantity { get; set; }

    /// <summary>
    /// How many completed sales included this item.
    /// </summary>
    public int TimesSold { get; set; }
}
