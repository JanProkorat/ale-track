using AleTrack.Common.Enums;
using AleTrack.Entities;

namespace AleTrack.Features.Orders.Commands.Update;

/// <summary>
/// Represents a data transfer object for updating an order,
/// including the delivery date and state of order to be updated.
/// </summary>
public sealed record UpdateOrderDto
{
    /// <summary>
    /// ID of related <see cref="Client"/>
    /// </summary>
    public Guid ClientId { get; set; }
    
    /// <summary>
    /// Date when the order should be delivered to the client
    /// </summary>
    public DateOnly? DeliveryDate { get; set; }
    
    /// <summary>
    /// State of the order
    /// </summary>
    public OrderState State { get; set; }
    
    
    /// <summary>
    /// List of items included in the order
    /// </summary>
    public List<UpdateOrderItemDto> OrderItems { get; set; } = [];
}

/// <summary>
/// Represents a data transfer object for creating an order item,
/// containing details about the product and its quantity.
/// </summary>
public sealed record UpdateOrderItemDto
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