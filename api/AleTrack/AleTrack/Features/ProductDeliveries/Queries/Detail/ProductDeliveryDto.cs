using AleTrack.Common.Enums;

namespace AleTrack.Features.ProductDeliveries.Queries.Detail;

/// <summary>
/// Represents the details of a product delivery.
/// </summary>
public sealed record ProductDeliveryDto
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
    /// Info about related vehicle
    /// </summary>
    public VehicleInfoDto? Vehicle { get; set; }
    
    /// <summary>
    /// Progress of the delivery
    /// </summary>
    public ProductDeliveryState State { get; set; }

    /// <summary>
    /// Info about related drivers
    /// </summary>
    public List<DriverInfoDto> Drivers { get; set; } = [];
    
    /// <summary>
    /// Note to the delivery
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// A collection of stops associated with a product delivery.
    /// Each stop provides details about the brewery, notes, and related information.
    /// </summary>
    public List<ProductDeliveryStopDto> Stops { get; set; } = [];
}

public record ProductDeliveryStopDto
{
    /// <summary>
    /// Public ID of the delivery stop
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Position of this stop on the route (0-based).
    /// </summary>
    public int Order { get; set; }

    /// <summary>
    /// Whether this stop is a brewery, a supplier or a custom waypoint.
    /// </summary>
    public DeliveryStopKind Kind { get; set; }

    /// <summary>
    /// Info about related brewery. Set only for brewery stops.
    /// </summary>
    public BreweryInfoDto? Brewery { get; set; }

    /// <summary>
    /// Info about the related supplier. Set only for supplier stops.
    /// </summary>
    public SupplierInfoDto? Supplier { get; set; }

    /// <summary>
    /// Display name of a custom stop. Null for brewery and supplier stops.
    /// </summary>
    public string? Label { get; set; }

    /// <summary>
    /// Latitude of a custom stop. Null for brewery and supplier stops.
    /// </summary>
    public decimal? Latitude { get; set; }

    /// <summary>
    /// Longitude of a custom stop. Null for brewery and supplier stops.
    /// </summary>
    public decimal? Longitude { get; set; }

    /// <summary>
    /// Note to the delivery stop
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// List of items included in the delivery stop — brewery products at a brewery stop,
    /// price-list goods at a supplier stop, none at a custom one.
    /// </summary>
    public List<ProductDeliveryItemDto> Products { get; set; } = [];
}

/// <summary>
/// One line of a delivery stop: either a brewery product or one charge kind of a supplier's good.
/// </summary>
/// <remarks>
/// Which of the two it is shows in whether <see cref="ProductId"/> or <see cref="SupplierGoodId"/>
/// is set — exactly one always is. <see cref="Name"/> is filled from whichever it is, so a
/// consumer that only renders the line needs no branch at all.
/// </remarks>
public sealed record ProductDeliveryItemDto
{
    /// <summary>
    /// Public ID of the product. Set on brewery lines.
    /// </summary>
    public Guid? ProductId { get; set; }

    /// <summary>
    /// Public ID of the supplier good. Set on supplier lines.
    /// </summary>
    public Guid? SupplierGoodId { get; set; }

    /// <summary>
    /// Which of the good's prices this line is for. Set on supplier lines.
    /// </summary>
    public SupplierChargeKind? ChargeKind { get; set; }

    /// <summary>
    /// Name of the product or of the good
    /// </summary>
    public string Name { get; set; } = null!;

    /// <summary>
    /// The good's size as the supplier states it — "10 kg", "50 l". Supplier lines only; a
    /// product's size is its container volume, which the client already holds in its catalogue.
    /// </summary>
    public string? Size { get; set; }

    /// <summary>
    /// Amount to be delivered
    /// </summary>
    public int Quantity { get; set; }

    /// <summary>
    /// Note to this particular line
    /// </summary>
    public string? Note { get; set; }
}

public record BreweryInfoDto(Guid Id, string Name);

/// <summary>
/// The supplier a stop calls at, with the coordinates the route map draws it at.
/// </summary>
/// <remarks>
/// Coordinates are resolved here rather than looked up by the client, as brewery ones are: the
/// suppliers list is behind the Suppliers permission, so a user who may plan dovozy but not read
/// the supplier register would otherwise get a route with a hole in it.
/// </remarks>
public record SupplierInfoDto(Guid Id, string Name, decimal? Latitude, decimal? Longitude);

public record VehicleInfoDto(Guid Id, string Name);
    
public record DriverInfoDto(Guid Id, string FirstName, string LastName);