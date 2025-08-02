namespace AleTrack.Features.Drivers.Queries.Detail;

public sealed record DriverDto
{
    /// <summary>
    /// Public ID of the driver
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// First name of the driver
    /// </summary>
    public string FirstName { get; set; } = null!;

    /// <summary>
    /// Last name of the driver
    /// </summary>
    public string LastName { get; set; } = null!;

    /// <summary>
    /// Phone number of the driver
    /// </summary>
    public string? PhoneNumber { get; set; }
    
    /// <summary>
    /// Color of the driver in the calendar - hexa code
    /// </summary>
    public string Color { get; set; } = null!;
    
    /// <summary>
    /// Dates when the driver is available
    /// </summary>
    public List<DriverAvailabilityDto> AvailableDates { get; set; } = [];
}

public record DriverAvailabilityDto(DateTime From, DateTime Until);