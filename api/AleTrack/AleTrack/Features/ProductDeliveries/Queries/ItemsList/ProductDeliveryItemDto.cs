namespace AleTrack.Features.ProductDeliveries.Queries.ItemsList;

/// <summary>
/// Represents a data transfer object for a product delivery item.
/// </summary>
public sealed record ProductDeliveryItemDto
{
    /// <summary>
    /// Public ID of related delivery
    /// </summary>
    public Guid ProductDeliveryId { get; set; }
    
    /// <summary>
    /// ID of related product
    /// </summary>
    public Guid ProductId { get; set; }

    /// <summary>
    /// Name of related product
    /// </summary>
    public string ProductName { get; set; } = null!;

    /// <summary>
    /// Amount of items to be delivered
    /// </summary>
    public int Amount { get; set; }
    
    /// <summary>
    /// Description of the product to be delivered
    /// </summary>
    public string? Note { get; set; }
}