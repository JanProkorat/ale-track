using AleTrack.Common.Enums;

namespace AleTrack.Features.ProductDeliveries.Commands.Update;

/// <summary>
/// Represents the data transfer object for updating a product delivery.
/// </summary>
public sealed record UpdateProductDeliveryDto
{
    /// <summary>
    /// Date when drivers will go to brewery for products to fill the inventory
    /// </summary>
    public DateTime DeliveryDate { get; set; }
    
    /// <summary>
    /// Progress of the delivery
    /// </summary>
    public ProductDeliveryState State { get; set; }
    
    /// <summary>
    /// IDs of related drivers
    /// </summary>
    public List<Guid> DriverIds { get; set; } = [];
    
    /// <summary>
    /// Public ID of related vehicle
    /// </summary>
    public Guid? VehicleId { get; set; }
    
    /// <summary>
    /// Note to the delivery
    /// </summary>
    public string? Note { get; set; }
}