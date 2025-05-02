namespace AleTrack.Features.Vehicles.Commands.Create;

public sealed record CreateVehicleDto
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