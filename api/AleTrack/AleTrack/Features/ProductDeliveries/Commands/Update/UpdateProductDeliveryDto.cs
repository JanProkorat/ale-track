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
    public DateOnly DeliveryDate { get; set; }
    
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

    /// <summary>
    /// A collection of stops specified in the delivery, each representing a brewery and the associated products to deliver.
    /// </summary>
    public List<UpdateProductDeliveryStopDto> Stops { get; set; } = [];
}

/// <summary>
/// Data transfer object representing a specific stop in a product delivery, including associated brewery details and delivered products.
/// </summary>
public sealed record UpdateProductDeliveryStopDto
{
    /// <summary>
    /// Public ID of the delivery stop
    /// </summary>
    public Guid? PublicId { get; set; }
    
    /// <summary>
    /// ID of the related brewery
    /// </summary>
    public Guid BreweryId { get; set; }
    
    /// <summary>
    /// Note to the delivery stop
    /// </summary>
    public string? Note { get; set; }
    
    /// <summary>
    /// Products to be delivered
    /// </summary>
    public List<UpdateProductDeliveryItemDto> Products { get; set; } = [];
}

/// <summary>
/// Data transfer object representing the details of an individual product item included in a delivery.
/// </summary>
public sealed record UpdateProductDeliveryItemDto
{
    /// <summary>
    /// ID of related product
    /// </summary>
    public Guid ProductId { get; set; }
    
    /// <summary>
    /// Quantity to be delivered
    /// </summary>
    public int Quantity { get; set; }
    
    /// <summary>
    /// Note to delivery of this particular product
    /// </summary>
    public string? Note { get; set; }
}