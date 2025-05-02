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
}