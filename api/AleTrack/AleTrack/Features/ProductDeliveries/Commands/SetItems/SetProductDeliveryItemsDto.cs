namespace AleTrack.Features.ProductDeliveries.Commands.SetItems;

/// <summary>
/// Represents the data transfer object for setting product delivery items.
/// </summary>
public sealed record SetProductDeliveryItemsDto
{
    /// <summary>
    /// Collection of product delivery items associated with the delivery.
    /// </summary>
    public List<ProductDeliveryItemsDto> Items { get; set; } = [];
}

/// <summary>
/// Represents the data transfer object for individual product delivery items.
/// </summary>
public sealed record ProductDeliveryItemsDto
{
    /// <summary>
    /// ID of related product
    /// </summary>
    public Guid ProductId { get; set; }
    
    /// <summary>
    /// Quantity to be delivered
    /// </summary>
    public int Quantity { get; set; }
    
    /// <summary>
    /// Note to delivery of this particular product
    /// </summary>
    public string? Note { get; set; }
}