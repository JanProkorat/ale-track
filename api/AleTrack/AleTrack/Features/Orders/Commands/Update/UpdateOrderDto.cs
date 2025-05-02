using AleTrack.Common.Enums;

namespace AleTrack.Features.Orders.Commands.Update;

/// <summary>
/// Represents a data transfer object for updating an order,
/// including the delivery date and state of order to be updated.
/// </summary>
public sealed record UpdateOrderDto
{
    /// <summary>
    /// Date when the order should be delivered to the client
    /// </summary>
    public DateTime? DeliveryDate { get; set; }
    
    /// <summary>
    /// State of the order
    /// </summary>
    public OrderState State { get; set; }
}