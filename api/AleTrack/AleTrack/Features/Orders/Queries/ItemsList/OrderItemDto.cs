namespace AleTrack.Features.Orders.Queries.ItemsList;

/// <summary>
/// Represents a data transfer object for an order item.
/// </summary>
public sealed record OrderItemDto
{
    /// <summary>
    /// Public ID of the item
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// ID of related order
    /// </summary>
    public Guid OrderId { get; set; }
    
    /// <summary>
    /// ID of related product
    /// </summary>
    public Guid ProductId { get; set; }

    /// <summary>
    /// Name of related product
    /// </summary>
    public string ProductName { get; set; } = null!;

    /// <summary>
    /// Represents the quantity of the product in the order item.
    /// </summary>
    public int Amount { get; set; }
}