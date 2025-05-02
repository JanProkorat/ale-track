namespace AleTrack.Features.ProductDeliveries.Utils;

/// <summary>
/// Error codes related to product delivery features
/// </summary>
public static class ProductDeliveryErrorCodes
{
    /// <summary>
    /// Error code for case when vehicle is not filled, but it should be
    /// </summary>
    public const string VehicleNotSelectedError = "VEHICLE_NOT_SELECTED";
    
    /// <summary>
    /// Error code for case when vehicle is not filled, but it should be
    /// </summary>
    public const string DriversNotSelectedError = "DRIVERS_NOT_SELECTED";
    
    /// <summary>
    /// Error code for case when no items were added to delivery
    /// </summary>
    public const string NoItemsInDeliveryError = "NO_ITEMS_IN_DELIVERY";
}