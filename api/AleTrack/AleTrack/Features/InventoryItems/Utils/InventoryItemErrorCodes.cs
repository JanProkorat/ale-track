namespace AleTrack.Features.InventoryItems.Utils;

/// <summary>
/// Error codes related to inventory item features
/// </summary>
public static class InventoryItemErrorCodes
{
    /// <summary>
    /// Error code for case when a stock row booked in from a supplier is asked to become a brewery
    /// product's row instead
    /// </summary>
    public const string SupplierGoodStockCannotBeRepointedError = "SUPPLIER_GOOD_STOCK_CANNOT_BE_REPOINTED";
}
