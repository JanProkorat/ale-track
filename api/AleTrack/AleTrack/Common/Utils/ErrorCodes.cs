namespace AleTrack.Common.Utils;

/// <summary>
/// Error codes related to endpoints
/// </summary>
public static class ErrorCodes
{
    /// <summary>
    /// Error code for unspecified errors
    /// </summary>
    public const string UnexpectedError = "UNEXPECTED_ERROR";
    
    /// <summary>
    /// Error code for validation errors
    /// </summary>
    public const string ValidationError = "VALIDATION_ERROR";
    
    /// <summary>
    /// Error code for case when param in request is null when it should not be
    /// </summary>
    public const string ValidationNotNullError = "VALIDATION_NOT_NULL_ERROR";
    
    /// <summary>
    /// Error code for case when param in request is empty when it should not be
    /// </summary>
    public const string ValidationNotEmptyError = "VALIDATION_NOT_EMPTY_ERROR"; 
    
    /// <summary>
    /// Error code for case when param length in request exceeded maximal allowed value
    /// </summary>
    public const string ValidationMaxLengthError = "VALIDATION_MAX_LENGTH_ERROR";

    /// <summary>
    /// Error code for case when a parameter value in a request exceeds the maximum allowed value
    /// </summary>
    public const string ValidationMaxValueExceededError = "VALIDATION_MAX_VALUE_EXCEEDED_ERROR";

    /// <summary>
    /// Error code for case when a parameter value in a request is less than the minimum allowed value
    /// </summary>
    public const string ValidationMinValueNotMatchedError = "VALIDATION_MINVALUE_NOT_MATCHED_ERROR";
    
    /// <summary>
    /// Error code for case when a required delivery date is today or in the past.
    /// Distinct from the generic min-value code so clients can show a precise message.
    /// </summary>
    public const string DeliveryDateInPast = "DELIVERY_DATE_IN_PAST";

    /// <summary>
    /// Error code for case when a requested entity is not found
    /// </summary>
    public const string NotfoundError = "ENTITY_NOT_FOUND";

    /// <summary>
    /// Error code for the case when an entity already exists
    /// </summary>
    public const string EntityAlreadyExistError = "ENTITY_ALREADY_EXISTS";
    
    /// <summary>
    /// Error code for case when property should be enum value, but is not
/// </summary>
    public const string ValidationEnumError = "VALIDATION_NOT_ENUM_PROPERTY";
    
    /// <summary>
    /// Error code for bad request errors
    /// </summary>
    public const string BadRequestError = "BAD_REQUEST_ERROR";

    /// <summary>
    /// Error code for case when an order is already assigned to an outgoing shipment
    /// </summary>
    public const string OrderAlreadyAssignedToOutgoingShipment = "ORDER_ALREADY_ASSIGNED_TO_OUTGOING_SHIPMENT";

    /// <summary>
    /// Error code for case when an outgoing shipment is not prepared with all required data
    /// </summary>
    public const string ShipmentNotPrepared = "SHIPMENT_NOT_PREPARED";

    /// <summary>
    /// Error code for case when an outgoing shipment cannot be marked as loaded without any stops
    /// </summary>
    public const string ShipmentCannotBeLoadedWithoutStops = "SHIPMENT_CANNOT_BE_LOADED_WITHOUT_STOPS";

    /// <summary>
    /// Error code for case when an outgoing shipment cannot be marked as loaded with no vehicle
    /// </summary>
    public const string ShipmentCannotBeLoadedWithoutVehicle = "SHIPMENT_CANNOT_BE_LOADED_WITHOUT_VEHICLE";
    
    /// <summary>
    /// Error code for case when an outgoing shipment is already delivered
    /// </summary>
    public const string ShipmentAlreadyDelivered = "SHIPMENT_ALREADY_DELIVERED";
    
    /// <summary>
    /// Error code for case when an outgoing shipment is already cancelled
    /// </summary>
    public const string ShipmentAlreadyCancelled = "SHIPMENT_ALREADY_CANCELLED";

    /// <summary>
    /// Error code for case when a brewery still owns products and cannot be deleted
    /// </summary>
    public const string BreweryHasProducts = "BREWERY_HAS_PRODUCTS";

    /// <summary>
    /// Error code for case when an outgoing shipment state transition is not allowed
    /// </summary>
    public const string ShipmentTransitionNotAllowed = "SHIPMENT_TRANSITION_NOT_ALLOWED";

    /// <summary>
    /// Error code for case when content frozen at loading time would be changed
    /// </summary>
    public const string ShipmentContentFrozen = "SHIPMENT_CONTENT_FROZEN";

    /// <summary>
    /// Error code for case when the content of a closed or loaded order would be changed
    /// </summary>
    public const string OrderContentFrozen = "ORDER_CONTENT_FROZEN";

    /// <summary>
    /// Error code for case when the price list being applied is not the one that was previewed
    /// </summary>
    public const string PriceListSourceChanged = "PRICE_LIST_SOURCE_CHANGED";

    /// <summary>
    /// Error code for case when an uploaded price list cannot be read
    /// </summary>
    public const string PriceListUnreadable = "PRICE_LIST_UNREADABLE";

    /// <summary>
    /// Error code for case when a driver account attempts an operation reserved for office staff.
    /// </summary>
    public const string DriverScopeForbidden = "DRIVER_SCOPE_FORBIDDEN";

    /// <summary>
    /// Error code for case when a driver record is already linked to a different user account.
    /// </summary>
    public const string DriverAlreadyLinkedToUser = "DRIVER_ALREADY_LINKED_TO_USER";

    /// <summary>
    /// Error code for case when a sale's buyer fields do not match its declared buyer kind.
    /// </summary>
    public const string SaleBuyerFieldsMismatch = "SALE_BUYER_FIELDS_MISMATCH";

    /// <summary>
    /// Error code for case when a sale paid by invoice has no billing name.
    /// </summary>
    public const string SaleBillingNameRequired = "SALE_BILLING_NAME_REQUIRED";

    /// <summary>
    /// Error code for case when an already completed sale would be changed.
    /// </summary>
    public const string SaleAlreadyCompleted = "SALE_ALREADY_COMPLETED";

    /// <summary>
    /// Error code for case when a sale line has no price and the sale cannot be completed.
    /// </summary>
    public const string SaleLinePriceMissing = "SALE_LINE_PRICE_MISSING";

    /// <summary>
    /// Error code for case when there is not enough stock to complete a sale.
    /// </summary>
    public const string SaleInsufficientStock = "SALE_INSUFFICIENT_STOCK";

    /// <summary>
    /// Error code for case when a payment state is set on a sale that is not invoiced.
    /// </summary>
    public const string SaleNotInvoiced = "SALE_NOT_INVOICED";

    /// <summary>
    /// Error code for case when payment is confirmed on a sale that is not awaiting one.
    /// </summary>
    public const string SaleNotAwaitingPayment = "SALE_NOT_AWAITING_PAYMENT";

    /// <summary>
    /// Error code for case when a run's invoicing is already filed and would be changed.
    /// </summary>
    public const string ShipmentInvoicingFiled = "SHIPMENT_INVOICING_FILED";

    /// <summary>
    /// Error code for case when a run would be filed with invoice rows still unfinished.
    /// </summary>
    public const string ShipmentInvoicingIncomplete = "SHIPMENT_INVOICING_INCOMPLETE";

    /// <summary>
    /// Error code for case when a run cannot be filed at all — a cancelled one.
    /// </summary>
    public const string ShipmentInvoicingNotFileable = "SHIPMENT_INVOICING_NOT_FILEABLE";

    /// <summary>
    /// Error code for case when a settled ledger entry would be handed to an order to settle.
    /// </summary>
    public const string LedgerEntryAlreadyResolved = "LEDGER_ENTRY_ALREADY_RESOLVED";

    /// <summary>
    /// Error code for case when an order of one client would take on another client's entry.
    /// </summary>
    public const string LedgerEntryClientMismatch = "LEDGER_ENTRY_CLIENT_MISMATCH";

    /// <summary>
    /// Error code for case when a second order would promise to settle the same entry.
    /// </summary>
    public const string LedgerEntryAlreadyAssigned = "LEDGER_ENTRY_ALREADY_ASSIGNED";

    /// <summary>
    /// Error code for case when a client's own product price is zero or negative.
    /// Distinct from the generic min-value code so clients can show a precise message.
    /// </summary>
    public const string ClientProductPriceMustBePositive = "CLIENT_PRODUCT_PRICE_MUST_BE_POSITIVE";

    /// <summary>
    /// Error code for case when the same product appears twice in one whole-list client price write.
    /// </summary>
    public const string ClientProductPriceDuplicateProduct = "CLIENT_PRODUCT_PRICE_DUPLICATE_PRODUCT";
}