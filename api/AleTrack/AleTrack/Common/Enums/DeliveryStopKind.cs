namespace AleTrack.Common.Enums;

/// <summary>
/// Kind of a delivery (Dovozy) stop.
/// </summary>
public enum DeliveryStopKind
{
    /// <summary>A stop at a brewery, from which products are collected.</summary>
    Brewery = 0,

    /// <summary>A custom waypoint (no brewery) — a free-form point on the route.</summary>
    Custom = 1,

    /// <summary>A stop at a supplier, from which goods off its price list are collected.</summary>
    Supplier = 2
}
