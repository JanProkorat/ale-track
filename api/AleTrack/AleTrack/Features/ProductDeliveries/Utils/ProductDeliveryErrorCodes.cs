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

    /// <summary>
    /// Error code for case when a line asks for a good that another supplier prices
    /// </summary>
    public const string SupplierGoodNotFromStopSupplierError = "SUPPLIER_GOOD_NOT_FROM_STOP_SUPPLIER";

    /// <summary>
    /// Error code for case when a line asks for a charge kind the good has no price for
    /// </summary>
    public const string SupplierGoodPriceMissingError = "SUPPLIER_GOOD_PRICE_MISSING";
}