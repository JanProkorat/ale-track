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
    /// Info about related brewery
    /// </summary>
    public BreweryInfoDto Brewery { get; set; } = null!;
    
    /// <summary>
    /// Note to the delivery stop
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// List of products included in the delivery stop.
    /// </summary>
    public List<ProductDeliveryItemDto> Products { get; set; } = [];
}

public record ProductDeliveryItemDto(Guid ProductId, string Name, int Quantity, string? Note);

public record BreweryInfoDto(Guid Id, string Name);

public record VehicleInfoDto(Guid Id, string Name);
    
public record DriverInfoDto(Guid Id, string FirstName, string LastName);