using AleTrack.Common.Enums;

namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// A non-order stop on an outgoing shipment: a free-form waypoint, the company warehouse, or a
/// supplier the run collects goods from.
/// </summary>
public sealed record CustomStopDto
{
    /// <summary>
    /// Public ID of an existing custom stop. Null when creating a new one.
    /// </summary>
    public Guid? Id { get; set; }

    /// <summary>
    /// Whether this is a free-form waypoint or the company warehouse.
    /// </summary>
    /// <remarks>
    /// A <see cref="OutgoingShipmentStopKind.Company"/> stop's label and coordinates
    /// are authored by the server from configuration — whatever the client sends in
    /// those fields is ignored, so a stale client cannot pin the warehouse elsewhere.
    /// The same holds for a <see cref="OutgoingShipmentStopKind.Supplier"/> stop, whose label and
    /// coordinates come from the supplier named by <see cref="SupplierId"/>.
    /// Defaults to <see cref="OutgoingShipmentStopKind.Custom"/> so an existing
    /// payload keeps its meaning.
    /// </remarks>
    public OutgoingShipmentStopKind Kind { get; set; } = OutgoingShipmentStopKind.Custom;

    /// <summary>
    /// The supplier collected from. Required when <see cref="Kind"/> is
    /// <see cref="OutgoingShipmentStopKind.Supplier"/>, ignored otherwise.
    /// </summary>
    /// <remarks>
    /// Round-tripped so the planner can place a pickup stop in the route before it exists — the
    /// reconciler then matches it by supplier and leaves it where it was put, exactly as it does
    /// for one it created itself. Whether the stop is needed at all is still the server's call:
    /// a supplier nothing is collected from is dropped however the client ordered it.
    /// </remarks>
    public Guid? SupplierId { get; set; }

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
