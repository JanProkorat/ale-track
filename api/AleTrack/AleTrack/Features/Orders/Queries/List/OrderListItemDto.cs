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
    /// Date the order was created — the list's default newest-first ordering key
    /// </summary>
    public DateTime CreatedDate { get; set; }
    
    /// <summary>
    /// Latest date when order needs to be delivered to the client
    /// </summary>
    public DateOnly? RequiredDeliveryDate { get; set; }

    /// <summary>
    /// Date the order was actually delivered (set when its shipment is delivered).
    /// </summary>
    public DateOnly? ActualDeliveryDate { get; set; }

    /// <summary>
    /// Public ID of the related client — lets the list be filtered down to one
    /// client (the client detail's order tab) without matching on the name.
    /// </summary>
    public Guid ClientId { get; set; }

    /// <summary>
    /// Name of the related client
    /// </summary>
    public string ClientName { get; set; } = null!;
    
    /// <summary>
    /// Planning state of the order
    /// </summary>
    public PlanningState PlanningState { get; set; }
}