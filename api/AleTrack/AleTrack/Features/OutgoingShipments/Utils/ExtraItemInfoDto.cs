namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// Confirm-only reference to an item owned by a stop's order.
/// </summary>
/// <remarks>
/// The shipment may flip the loading flag; it may not create or delete the row, so no
/// payload beyond the identity is accepted and an unknown ID is ignored rather than
/// treated as a new item.
/// </remarks>
public sealed record ExtraItemInfoDto
{
    /// <summary>Public ID of the item.</summary>
    public Guid Id { get; set; }

    /// <summary>Whether loading of this item is confirmed.</summary>
    public bool IsLoadingConfirmed { get; set; }
}
