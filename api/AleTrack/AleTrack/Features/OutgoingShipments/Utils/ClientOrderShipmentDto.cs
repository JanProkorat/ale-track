using AleTrack.Common.Enums;

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
    
    /// <summary>
    /// Kind of the selected address for the shipment
    /// </summary>
    public OutgoingShipmentStopAddressKind SelectedAddressKind { get; set; }

    /// <summary>
    /// List of order items to be shipped
    /// </summary>
    public List<OrderItemInfoDto> OrderItems { get; set; } = [];
}

public record OrderItemInfoDto
{
    /// <summary>
    /// ID of the order item
    /// </summary>
    public Guid OrderItemId { get; set; }
    
    /// <summary>
    /// FLag indicating if the loading of the order item is confirmed
    /// </summary>
    public bool IsLoadingConfirmed { get; set; }
}