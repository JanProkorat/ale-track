namespace AleTrack.Features.Drivers.Commands.Create;

/// <summary>
/// Data Transfer Object (DTO) for creating a new driver.
/// </summary>
public sealed record CreateDriverDto
{
    /// <summary>
    /// Gets or sets the first name of the driver.
    /// </summary>
    public string FirstName { get; set; } = null!;

    /// <summary>
    /// Gets or sets the last name of the driver.
    /// </summary>
    public string LastName { get; set; } = null!;
}