namespace AleTrack.Common.Enums;

/// <summary>
/// Kind of an outgoing-shipment stop.
/// </summary>
public enum OutgoingShipmentStopKind
{
    /// <summary>A delivery stop tied to a client order.</summary>
    Order = 0,

    /// <summary>A custom waypoint (no order) — a free-form point on the route.</summary>
    Custom = 1
}
