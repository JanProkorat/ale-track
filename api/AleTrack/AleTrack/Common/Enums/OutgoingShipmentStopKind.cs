namespace AleTrack.Common.Enums;

/// <summary>
/// Kind of an outgoing-shipment stop.
/// </summary>
public enum OutgoingShipmentStopKind
{
    /// <summary>A delivery stop tied to a client order.</summary>
    Order = 0,

    /// <summary>A custom waypoint (no order) — a free-form point on the route.</summary>
    Custom = 1,

    /// <summary>The company's own warehouse — where goods bought for stock come off.</summary>
    Company = 2,

    /// <summary>
    /// A supplier's own premises — where goods flagged
    /// <see cref="SupplierGoodPickupSource.Supplier"/> are collected on the way round.
    /// </summary>
    Supplier = 3
}
