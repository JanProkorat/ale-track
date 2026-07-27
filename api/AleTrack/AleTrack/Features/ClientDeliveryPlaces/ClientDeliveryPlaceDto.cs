using AleTrack.Common.Models;

namespace AleTrack.Features.ClientDeliveryPlaces;

/// <summary>
/// A delivery place saved on a client.
/// </summary>
public sealed record ClientDeliveryPlaceDto
{
    /// <summary>
    /// Public ID of the place
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Name shown in the picker
    /// </summary>
    public string Name { get; set; } = null!;

    /// <summary>
    /// Instruction for the driver
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// Location. Street/city parts may be empty for a map-picked place;
    /// latitude and longitude are always present.
    /// </summary>
    public AddressDto Address { get; set; } = null!;
}
