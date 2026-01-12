namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// DTO representing a client order shipment
/// </summary>
public sealed record ClientOrderShipmentDto
{
    /// <summary>
    /// ID of the client order to be shipped
    /// </summary>
    public Guid ClientOrderId { get; set; }

    /// <summary>
    /// Order of the shipment in the delivery sequence
    /// </summary>
    public int Order { get; set; }
}