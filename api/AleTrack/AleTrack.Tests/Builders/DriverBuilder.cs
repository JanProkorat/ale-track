using AleTrack.Entities;
using AleTrack.Features.Drivers.Commands.Create;
using AleTrack.Features.Drivers.Commands.Update;

namespace AleTrack.Tests.Builders;

public static class DriverBuilder
{
    public static Driver BuildEntity(
        Guid? publicId = null,
        string? firstName = null,
        string? lastName = null,
        string? phoneNumber = null,
        string? color = null,
        List<DriverAvailability>? availabilities = null)
    {
        return new Driver
        {
            PublicId = publicId ?? Guid.NewGuid(),
            FirstName = firstName ?? "John",
            LastName = lastName ?? "Doe",
            PhoneNumber = phoneNumber ?? "+420123456789",
            Color = color ?? "#FF5733",
            Availabilities = availabilities ?? []
        };
    }

    public static CreateDriverDto BuildCreateDto(
        string? firstName = null,
        string? lastName = null,
        string? phoneNumber = null,
        string? color = null,
        List<CreateDriverAvailabilityDto>? availableDates = null)
    {
        return new CreateDriverDto
        {
            FirstName = firstName ?? "John",
            LastName = lastName ?? "Doe",
            PhoneNumber = phoneNumber ?? "+420123456789",
            Color = color ?? "#FF5733",
            AvailableDates = availableDates ?? []
        };
    }

    public static UpdateDriverDto BuildUpdateDto(
        string? firstName = null,
        string? lastName = null,
        string? phoneNumber = null,
        string? color = null,
        List<UpdateDriverAvailabilityDto>? availableDates = null)
    {
        return new UpdateDriverDto
        {
            FirstName = firstName ?? "Jane",
            LastName = lastName ?? "Smith",
            PhoneNumber = phoneNumber ?? "+420987654321",
            Color = color ?? "#33FF57",
            AvailableDates = availableDates ?? []
        };
    }
}
