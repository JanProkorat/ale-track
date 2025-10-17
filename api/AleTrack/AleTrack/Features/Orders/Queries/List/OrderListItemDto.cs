using AleTrack.Common.Enums;

namespace AleTrack.Features.Orders.Queries.List;

/// <summary>
/// Represents an item in the list of orders. Provides detailed information about an order,
/// including client identifier, current state, delivery date, and the number of ordered products.
/// </summary>
public sealed record OrderListItemDto
{
    /// <summary>
    /// Public ID of the order
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// State of the order
    /// </summary>
    public OrderState State { get; set; }
    
    /// <summary>
    /// Latest date when order needs to be delivered to the client
    /// </summary>
    public DateOnly? RequiredDeliveryDate { get; set; }
    
    /// <summary>
    /// Name of the related client
    /// </summary>
    public string ClientName { get; set; } = null!;
}