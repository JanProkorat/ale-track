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
    /// The resolved destination: the place's address for
    /// <see cref="DeliveryAddressKind.DeliveryPlace"/>, the client's contact
    /// address for <see cref="DeliveryAddressKind.Contact"/>, otherwise the
    /// client's official address. Never null in practice — both projections
    /// fall back to the (non-nullable) official address when the selected
    /// kind's own address is unavailable (e.g. a <c>Contact</c> order whose
    /// client has since lost its contact address), so this silently renders
    /// the billing address rather than surfacing the mismatch.
    /// </summary>
    public AddressDto? Address { get; set; }
}
