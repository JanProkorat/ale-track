using AleTrack.Common.Enums;

namespace AleTrack.Features.ProductDeliveries.Queries.List;

public sealed record ProductDeliveryListItemDto
{
    /// <summary>
    /// Public ID of the entity
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Date when drivers will go to brewery for products to fill the inventory
    /// </summary>
    public DateOnly DeliveryDate { get; set; }
    
    /// <summary>
    /// Progress of the delivery
    /// </summary>
    public ProductDeliveryState State { get; set; }

    /// <summary>
    /// List of brewery names, each representing a delivery stop.
    /// </summary>
    public List<string> StopNames { get; set; } = [];
    
    /// <summary>
    /// Planning state of the order
    /// </summary>
    public PlanningState PlanningState { get; set; }
}