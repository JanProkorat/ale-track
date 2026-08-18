using AleTrack.Common.Enums;
using AleTrack.Common.Models;

namespace AleTrack.Features.ProductDeliveries.Utils;

/// <summary>
/// Provides utility methods for handling scenarios related to product delivery exceptions.
/// </summary>
internal static class ProductDeliveryThrowHelper
{
    /// <summary>
    /// Throws an exception indicating that there are no items to deliver for the specified product delivery state.
    /// </summary>
    /// <param name="state">The current state of the product delivery.</param>
    /// <exception cref="AleTrackException">
    /// Thrown when no items are available for delivery in the specified state.
    /// </exception>
    public static void NoItemsToDeliver(ProductDeliveryState state)
        => throw new AleTrackException(
            StatusCodes.Status400BadRequest,
            ProductDeliveryErrorCodes.NoItemsInDeliveryError,
            new Dictionary<string, object>
            {
                { nameof(state), state }
            });

    /// <summary>
    /// Throws an exception indicating that a line asks for a good priced by a different supplier
    /// than the one whose stop it sits on.
    /// </summary>
    /// <remarks>
    /// Not a 404 — both the good and the supplier exist. What does not exist is the relationship
    /// between them, which is a bad request about otherwise valid ids.
    /// </remarks>
    public static void SupplierGoodNotFromStopSupplier(Guid supplierGoodId, Guid supplierId)
        => throw new AleTrackException(
            StatusCodes.Status400BadRequest,
            ProductDeliveryErrorCodes.SupplierGoodNotFromStopSupplierError,
            new Dictionary<string, object>
            {
                { nameof(supplierGoodId), supplierGoodId },
                { nameof(supplierId), supplierId }
            });

    /// <summary>
    /// Throws an exception indicating that the good has no price for the requested charge kind.
    /// </summary>
    public static void SupplierGoodPriceMissing(Guid supplierGoodId, SupplierChargeKind chargeKind)
        => throw new AleTrackException(
            StatusCodes.Status400BadRequest,
            ProductDeliveryErrorCodes.SupplierGoodPriceMissingError,
            new Dictionary<string, object>
            {
                { nameof(supplierGoodId), supplierGoodId },
                { nameof(chargeKind), chargeKind }
            });
}