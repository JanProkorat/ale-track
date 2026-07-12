namespace AleTrack.Features.Drivers.Queries.List;

/// <summary>
/// Represents a data transfer object for a driver in a list.
/// This object is used to encapsulate details about a driver such as their identifier, first name, and last name.
/// </summary>
public sealed record DriverListItemDto
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
    public List<DriverAvailabilityListItemDto> AvailableDates { get; set; } = [];
}

public record DriverAvailabilityListItemDto(DateTime From, DateTime Until);