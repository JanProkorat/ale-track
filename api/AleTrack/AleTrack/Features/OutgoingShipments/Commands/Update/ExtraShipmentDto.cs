namespace AleTrack.Features.OutgoingShipments.Commands.Update;

public record ExtraShipmentDto
{
    /// <summary>
    /// Public ID of the extra item entity. Null when creating a new item.
    /// </summary>
    public Guid? Id { get; set; }
    
    /// <summary>
    /// Represents the quantity of the product getting from the brewery in the shipment,
    /// that will be delivered to the garage.
    /// </summary>
    public int Quantity { get; set; }
    
    /// <summary>
    /// FLag indicating if the loading of the order item is confirmed
    /// </summary>
    public bool IsLoadingConfirmed { get; set; }
    
    /// <summary>
    /// Number of pieces to be put on the first invoice
    /// </summary>
    public int? FirstInvoiceQuantity { get; set; }
    
    /// <summary>
    /// Number of pieces to be put on the second invoice
    /// </summary>
    public int? SecondInvoiceQuantity { get; set; }
}

/// <summary>
/// Dto wrapper for extra products to be delivered to the inventory from the brewery
/// </summary>
public record InventoryExtraShipmentDto : ExtraShipmentDto
{
    /// <summary>
    /// ID of related product
    /// </summary>
    public Guid ProductId { get; set; }
}

/// <summary>
/// Data transfer object for extra products to be delivered from the inventory to the client
/// </summary>
public record ClientExtraShipmentDto : ExtraShipmentDto
{
    /// <summary>
    /// ID of the inventory item this extra product is taken from. Null if not from inventory.
    /// </summary>
    public Guid InventoryItemId { get; set; }
}

/// <summary>
/// Custom extra product DTO.
/// </summary>
public record CustomExtraShipmentDto : ExtraShipmentDto
{
    /// <summary>
    /// Description of the extra product.
    /// </summary>
    public string Description { get; set; } = null!;
}