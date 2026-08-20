using AleTrack.Common.Enums;
using AleTrack.Entities;

namespace AleTrack.Features.Orders.Queries.Detail;

/// <summary>
/// The outgoing shipment ("vývoz") that carries this order, resolved through the
/// order's <see cref="OutgoingShipmentStop"/>. Null on an order that is not planned
/// onto any run, so the order detail can simply omit the whole section.
/// </summary>
public sealed record OrderOutgoingShipmentDto
{
    /// <summary>
    /// Public ID of the shipment — what the order detail links to.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Name of the shipment
    /// </summary>
    public string Name { get; set; } = null!;

    /// <summary>
    /// State of the shipment
    /// </summary>
    public OutgoingShipmentState State { get; set; }

    /// <summary>
    /// Date the shipment delivers. Null while the run is still being planned.
    /// </summary>
    public DateTime? DeliveryDate { get; set; }

    /// <summary>
    /// Position of this order's stop in the route, 1-based as the planner numbers it.
    /// </summary>
    public int StopOrder { get; set; }

    /// <summary>
    /// Total number of stops on the run, so the position reads as "3 of 7".
    /// </summary>
    public int StopCount { get; set; }

    /// <summary>
    /// Name of the vehicle assigned to the run. Null until one is picked.
    /// </summary>
    public string? VehicleName { get; set; }

    /// <summary>
    /// Full names of the drivers assigned to the run.
    /// </summary>
    public List<string> DriverNames { get; set; } = [];
}
