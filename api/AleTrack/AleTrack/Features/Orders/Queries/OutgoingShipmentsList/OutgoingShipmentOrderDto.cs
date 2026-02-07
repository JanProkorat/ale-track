using AleTrack.Common.Enums;
using AleTrack.Common.Models;

namespace AleTrack.Features.Orders.Queries.OutgoingShipmentsList;

public record OutgoingShipmentOrderDto
{
    /// <summary>
    /// Public ID of the order
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Latest date when order needs to be delivered to the client
    /// </summary>
    public DateOnly? RequiredDeliveryDate { get; set; }
    
    /// <summary>
    /// Name of the related client
    /// </summary>
    public string ClientName { get; set; } = null!;

    /// <summary>
    /// Official address of the client
    /// </summary>
    public AddressDto ClientOfficialAddress { get; set; } = null!;
    
    /// <summary>
    /// Contact address of the client
    /// </summary>
    public AddressDto? ClientContactAddress { get; set; }
    
    /// <summary>
    /// List of order items
    /// </summary>
    public List<UnassignedOrderItemDto> Items { get; set; } = [];
}

public record UnassignedOrderItemDto
{
    /// <summary>
    /// ID of related product
    /// </summary>
    public Guid ProductId { get; set; }

    /// <summary>
    /// Name of related product
    /// </summary>
    public string ProductName { get; set; } = null!;

    /// <summary>
    /// Represents the quantity of the product in the order item.
    /// </summary>
    public int Quantity { get; set; }
    
    /// <summary>
    /// Kind of the product
    /// </summary>
    public ProductKind Kind { get; set; }
    
    /// <summary>
    /// Type of the product
    /// </summary>
    public ProductType Type { get; set; }
    
    /// <summary>
    /// How much alcohol product contains
    /// </summary>
    public float? AlcoholPercentage { get; set; }
    
    /// <summary>
    /// Degree of the beer - 10, 11, 12 etc.
    /// </summary>
    public float? PlatoDegree { get; set; }
    
    /// <summary>
    /// Size of the whole package
    /// </summary>
    public double? PackageSize { get; set; }
    
    /// <summary>
    /// Weight of the product in kilograms
    /// </summary>
    public double? Weight { get; set; }
}