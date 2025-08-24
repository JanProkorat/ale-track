using AleTrack.Entities;

namespace AleTrack.Features.Orders.Commands.Create;

/// <summary>
/// Represents a data transfer object for creating an order,
/// including client details, delivery date, and a list of order items.
/// </summary>
public sealed record CreateOrderDto
{
    /// <summary>
    /// ID of related <see cref="Client"/>
    /// </summary>
    public Guid ClientId { get; set; }
    
    /// <summary>
    /// Date when order should be delivered
    /// </summary>
    public DateOnly? DeliveryDate { get; set; }

    /// <summary>
    /// List of items included in the order
    /// </summary>
    public List<CreateOrderItemDto> OrderItems { get; set; } = [];
}

/// <summary>
/// Represents a data transfer object for creating an order item,
/// containing details about the product and its quantity.
/// </summary>
public sealed record CreateOrderItemDto
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