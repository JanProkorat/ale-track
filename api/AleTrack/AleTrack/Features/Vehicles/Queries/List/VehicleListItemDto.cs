namespace AleTrack.Features.Vehicles.Queries.List;

/// <summary>
/// Represents a data transfer object for vehicle list items.
/// </summary>
public sealed class VehicleListItemDto
{
    /// <summary>
    /// Unique identifier of the vehicle.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Name of the vehicle
    /// </summary>
    public string Name { get; set; } = null!;
    
    /// <summary>
    /// Max weight that vehicle can carry
    /// </summary>
    public double MaxWeight { get; set; }
}