namespace AleTrack.Features.ProductDeliveries.Commands.Create;

/// <summary>
/// Data transfer object representing the details required to create a products delivery.
/// </summary>
public sealed record CreateProductsDeliveryDto
{
    /// <summary>
    /// Date when drivers are going to brewery for the products
    /// </summary>
    public DateOnly DeliveryDate { get; set; }

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
    public List<CreateProductDeliveryStopDto> Stops { get; set; } = [];
}

/// <summary>
/// Data transfer object representing a specific stop in a product delivery, including associated brewery details and delivered products.
/// </summary>
public sealed record CreateProductDeliveryStopDto
{
    /// <summary>
    /// ID of related brewery
    /// </summary>
    public Guid BreweryId { get; set; }
    
    /// <summary>
    /// Note to the delivery
    /// </summary>
    public string? Note { get; set; }
    
    /// <summary>
    /// Products to be delivered
    /// </summary>
    public List<CreateProductDeliveryItemDto> Products { get; set; } = [];
}

/// <summary>
/// Data transfer object representing the details of an individual product item included in a delivery.
/// </summary>
public sealed record CreateProductDeliveryItemDto
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