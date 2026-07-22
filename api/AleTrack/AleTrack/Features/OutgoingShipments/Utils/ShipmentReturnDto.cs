namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// A returnable item the client hands back on an outgoing shipment (empty kegs,
/// bottles…). Used for both read and write — <see cref="Id"/> is set on read and
/// on updates of an existing item, and null for newly-added ones.
/// </summary>
public sealed record ShipmentReturnDto
{
    /// <summary>Public ID of the return item (null when newly added).</summary>
    public Guid? Id { get; set; }

    /// <summary>Name of the returned item.</summary>
    public string Name { get; set; } = null!;

    /// <summary>Amount returned.</summary>
    public int Quantity { get; set; }
}
