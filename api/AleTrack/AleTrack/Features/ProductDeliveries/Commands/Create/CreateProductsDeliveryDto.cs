namespace AleTrack.Features.ProductDeliveries.Commands.Create;

/// <summary>
/// Data transfer object representing the details required to create a products delivery.
/// </summary>
public sealed record CreateProductsDeliveryDto
{
    /// <summary>
    /// ID of related brewery
    /// </summary>
    public Guid BreweryId { get; set; }
    
    /// <summary>
    /// Date when drivers are going to brewery for the products
    /// </summary>
    public DateTime DeliveryDate { get; set; }

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
    /// Products to be delivered
    /// </summary>
    public List<ProductDeliveryItemDto> Products { get; set; } = [];
}

/// <summary>
/// Data transfer object representing the details of an individual product item included in a delivery.
/// </summary>
public sealed record ProductDeliveryItemDto
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