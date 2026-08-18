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
    /// Whether this stop is a brewery, a supplier or a custom waypoint.
    /// </summary>
    public DeliveryStopKind Kind { get; set; }

    /// <summary>
    /// ID of the related brewery. Required for brewery stops, null otherwise.
    /// </summary>
    public Guid? BreweryId { get; set; }

    /// <summary>
    /// ID of the related supplier. Required for supplier stops, null otherwise.
    /// </summary>
    public Guid? SupplierId { get; set; }

    /// <summary>
    /// Display name of a custom stop. Required for custom stops, null otherwise.
    /// </summary>
    public string? Label { get; set; }

    /// <summary>
    /// Latitude of a custom stop. Required for custom stops.
    /// </summary>
    public decimal? Latitude { get; set; }

    /// <summary>
    /// Longitude of a custom stop. Required for custom stops.
    /// </summary>
    public decimal? Longitude { get; set; }

    /// <summary>
    /// Note to the delivery stop
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// Items to be collected here — products at a brewery stop, goods at a supplier stop,
    /// empty at a custom one.
    /// </summary>
    public List<UpdateProductDeliveryItemDto> Products { get; set; } = [];
}

/// <summary>
/// Data transfer object representing one line of a delivery stop: either a brewery product or one
/// charge kind of a supplier's good.
/// </summary>
public sealed record UpdateProductDeliveryItemDto
{
    /// <summary>
    /// ID of related product. Required on a brewery stop's lines, null on a supplier stop's.
    /// </summary>
    public Guid? ProductId { get; set; }

    /// <summary>
    /// ID of the related supplier good. Required on a supplier stop's lines, null on a brewery's.
    /// </summary>
    public Guid? SupplierGoodId { get; set; }

    /// <summary>
    /// Which of the good's prices this line is for. Required alongside
    /// <see cref="SupplierGoodId"/>, null without it.
    /// </summary>
    public SupplierChargeKind? ChargeKind { get; set; }

    /// <summary>
    /// Quantity to be delivered
    /// </summary>
    public int Quantity { get; set; }

    /// <summary>
    /// Note to delivery of this particular product
    /// </summary>
    public string? Note { get; set; }
}