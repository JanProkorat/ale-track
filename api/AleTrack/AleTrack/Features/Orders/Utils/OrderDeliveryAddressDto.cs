using AleTrack.Common.Enums;
using AleTrack.Common.Models;

namespace AleTrack.Features.Orders.Utils;

/// <summary>
/// An order's delivery destination, already resolved server-side so the
/// consumer renders it without looking anything up. Returned on the order
/// detail and on an outgoing-shipment stop.
/// </summary>
public sealed record OrderDeliveryAddressDto
{
    /// <summary>
    /// Which of the three kinds of address this is
    /// </summary>
    public DeliveryAddressKind Kind { get; set; }

    /// <summary>
    /// Public ID of the delivery place, so an editor can re-select the exact
    /// choice. The name alone does not round-trip — two places may share one.
    /// </summary>
    public Guid? PlaceId { get; set; }

    /// <summary>
    /// Name of the delivery place. Set only for
    /// <see cref="DeliveryAddressKind.DeliveryPlace"/>, and set even when the
    /// place has since been soft-deleted.
    /// </summary>
    public string? PlaceName { get; set; }

    /// <summary>
    /// The place's instruction for the driver
    /// </summary>
    public string? PlaceNote { get; set; }

    /// <summary>
    /// The resolved destination. Null only if the client has no address of the
    /// selected kind at all.
    /// </summary>
    public AddressDto? Address { get; set; }
}
