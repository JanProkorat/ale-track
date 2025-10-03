using AleTrack.Entities;
using AleTrack.Features.Vehicles.Commands.Create;
using AleTrack.Features.Vehicles.Commands.Update;

namespace AleTrack.Tests.Builders;

public static class VehicleBuilder
{
    public static Vehicle BuildEntity(
        Guid? publicId = null,
        string? name = null,
        double? maxWeight = null)
    {
        return new Vehicle
        {
            PublicId = publicId ?? Guid.NewGuid(),
            Name = name ?? "Default Vehicle",
            MaxWeight = maxWeight ?? 1500.0
        };
    }

    public static CreateVehicleDto BuildCreateDto(
        string? name = null,
        double? maxWeight = null)
    {
        return new CreateVehicleDto
        {
            Name = name ?? "Test Vehicle",
            MaxWeight = maxWeight ?? 2000.0
        };
    }

    public static UpdateVehicleDto BuildUpdateDto(
        string? name = null,
        double? maxWeight = null)
    {
        return new UpdateVehicleDto
        {
            Name = name ?? "Updated Vehicle",
            MaxWeight = maxWeight ?? 2500.0
        };
    }
}
