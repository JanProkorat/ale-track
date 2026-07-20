namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// A custom (non-order) stop on an outgoing shipment — a free-form waypoint the
/// route passes through.
/// </summary>
public sealed record CustomStopDto
{
    /// <summary>
    /// Public ID of an existing custom stop. Null when creating a new one.
    /// </summary>
    public Guid? Id { get; set; }

    /// <summary>
    /// Position of the stop in the shipment route.
    /// </summary>
    public int Order { get; set; }

    /// <summary>
    /// Display label of the stop.
    /// </summary>
    public string Label { get; set; } = null!;

    /// <summary>
    /// Optional note.
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// Latitude of the waypoint.
    /// </summary>
    public decimal Latitude { get; set; }

    /// <summary>
    /// Longitude of the waypoint.
    /// </summary>
    public decimal Longitude { get; set; }
}
