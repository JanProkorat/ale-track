namespace AleTrack.Features.Vehicles.Queries.Detail;

/// <summary>
/// Represents a data transfer object for a vehicle, encapsulating basic details
/// such as its unique identifier, name, and maximum weight.
/// </summary>
public sealed record VehicleDto
{
    /// <summary>
    /// ID of the Brewery
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Name of the client
    /// </summary>
    public string Name { get; set; } = null!;
    
    /// <summary>
    /// Max Weight that vehicle can carry
    /// </summary>
    public double MaxWeight { get; set; }
}