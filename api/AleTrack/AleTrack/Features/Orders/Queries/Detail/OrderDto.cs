using AleTrack.Common.Enums;

namespace AleTrack.Features.Orders.Queries.Detail;

/// <summary>
/// Represents the detailed data transfer object for an order, including associated client information,
/// order status, delivery date, creation date, and a list of order items.
/// </summary>
public sealed record OrderDto
{
    /// <summary>
    /// ID of the order
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Info about related client
    /// </summary>
    public ClientInfoDto Client { get; set; } = null!;
    
    /// <summary>
    /// State of the order
    /// </summary>
    public OrderState State { get; set; }
    
    /// <summary>
    /// Date when order needs to be delivered to the client
    /// Can be null only in state <see cref="OrderState.New"/>
    /// </summary>
    public DateOnly? DeliveryDate { get; set; }
    
    /// <summary>
    /// Date when the order was created
    /// </summary>
    public DateTime CreatedDate { get; set; }

    /// <summary>
    /// Collection of items associated with the order.
    /// </summary>
    public List<OrderItemDto> OrderItems { get; set; } = [];
}

/// <summary>
/// Represents a client associated with an order, encapsulating identifying details.
/// </summary>
public sealed record ClientInfoDto
{
    /// <summary>
    /// ID of the client
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Name of the client
    /// </summary>
    public string Name { get; set; } = null!;
}


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
    public int Quantity { get; set; }
}