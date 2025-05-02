
namespace AleTrack.Features.Orders.Commands.SetOrderItems;

/// <summary>
/// Represents a data transfer object for setting a collection of order items,
/// allowing specification of multiple items associated with an order.
/// </summary>
public sealed record SetOrderItemsDto
{
    /// <summary>
    /// A collection of items included in the order
    /// </summary>
    public List<OrderItemDto> OrderItems { get; set; } = [];
}

/// <summary>
/// Represents a data transfer object for creating an order item,
/// containing details about the product and its quantity.
/// </summary>
public sealed record OrderItemDto
{
    /// <summary>
    /// Id of related <see cref="Product"/>
    /// </summary>
    public Guid ProductId { get; set; }
    
    /// <summary>
    /// Amount of goods ordered
    /// </summary>
    public int Quantity { get; set; }
}