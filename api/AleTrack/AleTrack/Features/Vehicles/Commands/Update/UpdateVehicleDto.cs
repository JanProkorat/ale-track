namespace AleTrack.Features.Vehicles.Commands.Update;

public sealed record UpdateVehicleDto
{
    /// <summary>
    /// Name of the vehicle
    /// </summary>
    public string Name { get; set; } = null!;
    
    /// <summary>
    /// Max weight that vehicle can carry
    /// </summary>
    public double MaxWeight { get; set; }
}