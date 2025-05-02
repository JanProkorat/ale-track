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
}