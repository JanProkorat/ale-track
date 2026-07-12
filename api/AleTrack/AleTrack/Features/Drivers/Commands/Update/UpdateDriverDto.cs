namespace AleTrack.Features.Drivers.Commands.Update;

public sealed record UpdateDriverDto
{
    /// <summary>
    /// Gets or sets the first name of the driver.
    /// </summary>
    public string FirstName { get; set; } = null!;

    /// <summary>
    /// Gets or sets the last name of the driver.
    /// </summary>
    public string LastName { get; set; } = null!;
    
    /// <summary>
    /// Phone number
    /// </summary>
    public string? PhoneNumber { get; set; }
    
    /// <summary>
    /// Color of the driver in the calendar - hexa code
    /// </summary>
    public string Color { get; set; } = null!;
    
    /// <summary>
    /// Dates when the driver is available
    /// </summary>
    public List<UpdateDriverAvailabilityDto> AvailableDates { get; set; } = [];
}

public record UpdateDriverAvailabilityDto(DateTime From, DateTime Until);