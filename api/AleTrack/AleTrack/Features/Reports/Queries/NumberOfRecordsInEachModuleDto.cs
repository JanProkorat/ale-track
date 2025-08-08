namespace AleTrack.Features.Reports.Queries;

/// <summary>
/// Represents a data transfer object containing the count of records
/// in various sections such as clients, breweries, inventory items,
/// drivers, and vehicles.
/// </summary>
public sealed record NumberOfRecordsInEachModuleDto
{
    /// <summary>
    /// Total number of clients in the database.
    /// </summary>
    public int ClientsCount { get; set; }

    /// <summary>
    /// Total number of breweries in the database.
    /// </summary>
    public int BreweriesCount { get; set; }

    /// <summary>
    /// Total count of inventory items in the database
    /// </summary>
    public int InventoryItemsCount { get; set; }
    
    /// <summary>
    /// Total count of drivers in the database
    /// </summary>
    public int DriversCount { get; set; }
    
    /// <summary>
    /// Total count of vehicles in the database
    /// </summary>
    public int VehiclesCount { get; set; }
    
    /// <summary>
    /// Total count of vehicles in the database
    /// </summary>
    public int UsersCount { get; set; }
}