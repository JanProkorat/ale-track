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

    /// <summary>
    /// Loading confirmation for the order's custom extras. Confirm-only: unknown IDs
    /// are ignored, because the shipment confirms extras rather than authoring them.
    /// </summary>
    public List<ExtraItemInfoDto> CustomExtraItems { get; set; } = [];
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

    /// <summary>
    /// How many of this item's pieces are taken from our own stock rather than supplied
    /// by the brewery. Never more than the ordered quantity.
    /// </summary>
    public int QuantityFromInventory { get; set; }

    /// <summary>
    /// Stock entry the sourced pieces come from. Required when
    /// <see cref="QuantityFromInventory"/> is above zero, ignored otherwise.
    /// </summary>
    public Guid? InventoryItemId { get; set; }
}