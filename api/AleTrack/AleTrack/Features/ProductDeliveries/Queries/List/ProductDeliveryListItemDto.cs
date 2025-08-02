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
    /// Number of assigned drivers
    /// </summary>
    public int NumOfAssignedDrivers { get; set; }
    
    /// <summary>
    /// Info about related vehicle
    /// </summary>
    public VehicleInfoDto? Vehicle { get; set; }
    
    public record VehicleInfoDto(Guid Id, string Name);
}