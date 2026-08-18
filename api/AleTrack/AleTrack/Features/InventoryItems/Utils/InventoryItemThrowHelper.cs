using AleTrack.Common.Models;

namespace AleTrack.Features.InventoryItems.Utils;

/// <summary>
/// Provides utility methods for handling scenarios related to inventory item exceptions.
/// </summary>
internal static class InventoryItemThrowHelper
{
    /// <summary>
    /// Throws an exception indicating that a supplier good's stock row cannot be turned into a
    /// brewery product's row.
    /// </summary>
    /// <remarks>
    /// A stock row's identity comes from the dovoz that booked it in, and the check constraint on
    /// inventory_items refuses a row holding both references. Rejecting it here makes that a stated
    /// 400 rather than a constraint violation surfacing as a 500.
    ///
    /// Quantity and note stay editable on such a row, which is what a stock correction needs.
    /// </remarks>
    public static void SupplierGoodStockCannotBeRepointed(Guid inventoryItemId, Guid productId)
        => throw new AleTrackException(
            StatusCodes.Status400BadRequest,
            InventoryItemErrorCodes.SupplierGoodStockCannotBeRepointedError,
            new Dictionary<string, object>
            {
                { nameof(inventoryItemId), inventoryItemId },
                { nameof(productId), productId }
            });
}
