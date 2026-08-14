namespace AleTrack.Features.Reports.Queries;

/// <summary>
/// Represents a data transfer object containing the count of records
/// in various sections such as clients, breweries, inventory items,
/// drivers, and vehicles.
/// </summary>
/// <remarks>
/// Every count is <c>null</c> when the caller has no <c>View</c> permission on the owning
/// module — a null means "you may not know", deliberately different from a zero, so the
/// dashboard cannot be used to infer how much data exists in a module the caller cannot open.
/// </remarks>
public sealed record NumberOfRecordsInEachModuleDto
{
    /// <summary>
    /// Total number of clients in the database, or null when the caller has no access
    /// to the Clients module.
    /// </summary>
    public int? ClientsCount { get; set; }

    /// <summary>
    /// Total number of unfinished orders in the database, or null when the caller has no
    /// access to the Orders module.
    /// </summary>
    public int? OrdersCount { get; set; }

    /// <summary>
    /// Total number of breweries in the database, or null when the caller has no access
    /// to the Breweries module.
    /// </summary>
    public int? BreweriesCount { get; set; }

    /// <summary>
    /// Total count of inventory items in the database, or null when the caller has no
    /// access to the Inventory module.
    /// </summary>
    public int? InventoryItemsCount { get; set; }

    /// <summary>
    /// Total count of drivers in the database, or null when the caller has no access
    /// to the Drivers module.
    /// </summary>
    public int? DriversCount { get; set; }

    /// <summary>
    /// Total count of vehicles in the database, or null when the caller has no access
    /// to the Vehicles module.
    /// </summary>
    public int? VehiclesCount { get; set; }

    /// <summary>
    /// Total count of users in the database, or null when the caller has no access
    /// to the Users module.
    /// </summary>
    public int? UsersCount { get; set; }

    /// <summary>
    /// Total count of active outgoing shipments in the database, or null when the caller
    /// has no access to the Shipments module.
    /// </summary>
    public int? OutgoingShipmentsCount { get; set; }

    /// <summary>
    /// Total count of active products delivered in the database, or null when the caller
    /// has no access to the Deliveries module.
    /// </summary>
    public int? ProductDeliveriesCount { get; set; }

    /// <summary>
    /// Total count of unfinished garage sales in the database, or null when the caller has no
    /// access to the Sales module.
    /// </summary>
    /// <remarks>
    /// Unfinished means anything not yet <see cref="Common.Enums.SaleState.Completed"/> — a draft
    /// still being written at the counter as well as an invoiced sale waiting for its payment.
    /// Both are open work for the person watching the badge.
    /// </remarks>
    public int? SalesCount { get; set; }
}
