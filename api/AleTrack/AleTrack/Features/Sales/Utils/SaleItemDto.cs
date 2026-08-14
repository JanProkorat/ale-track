namespace AleTrack.Features.Sales.Utils;

/// <summary>
/// One line of a sale as sent by the client.
/// </summary>
/// <remarks>
/// Carries only what the counter decides — which stock row, how many, at what price. The
/// descriptive fields (name, package size, ceník price) are snapshotted server-side from the
/// stock row by <see cref="SaleLineWriter"/>, so a client cannot mislabel or misprice a line's
/// provenance.
/// </remarks>
public sealed record SaleItemDto
{
    /// <summary>
    /// Public ID of the inventory item the pieces are taken from.
    /// </summary>
    public Guid InventoryItemId { get; set; }

    /// <summary>
    /// Pieces sold.
    /// </summary>
    public int Quantity { get; set; }

    /// <summary>
    /// Price per piece with VAT actually charged. Null while a draft is still being priced —
    /// completion rejects a sale that still has an unpriced line.
    /// </summary>
    public decimal? UnitPriceWithVat { get; set; }

    /// <summary>
    /// Free-form note about this line.
    /// </summary>
    public string? Note { get; set; }
}
