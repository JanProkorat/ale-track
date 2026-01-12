using AleTrack.Common.Enums;

namespace AleTrack.Features.OutgoingShipments.Queries.List;

public sealed record OutgoingShipmentListItemDto
{
    /// <summary>
    /// Public ID of the outgoing shipment
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Current state of the outgoing shipment
    /// </summary>
    public OutgoingShipmentState State { get; set; }

    /// <summary>
    /// Date when the shipment is scheduled for delivery
    /// </summary>
    public DateTime? DeliveryDate { get; set; }
}