using AleTrack.Common.Enums;
using AleTrack.Common.Models;

namespace AleTrack.Features.OutgoingShipments.Queries.Detail;

/// <summary>
/// Data transfer object representing detailed information about an outgoing shipment
/// </summary>
public sealed record OutgoingShipmentDetailDto
{
    /// <summary>
    /// Public ID of the outgoing shipment
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Current state of the outgoing shipment
    /// </summary>
    public OutgoingShipmentState State { get; set; }

    /// <summary>
    /// Date when the shipment is scheduled for delivery
    /// </summary>
    public DateTime? DeliveryDate { get; set; }

    /// <summary>
    /// ID of the vehicle assigned to the shipment
    /// </summary>
    public Guid? VehicleId { get; set; }

    /// <summary>
    /// List of driver IDs assigned to the shipment
    /// </summary>
    public List<Guid> DriverIds { get; set; } = [];

    /// <summary>
    /// List of stops during the shipment
    /// </summary>
    public List<OutgoingShipmentStopDto> Stops { get; set; } = [];
}

/// <summary>
/// Data transfer object representing a stop in an outgoing shipment route
/// </summary>
public sealed record OutgoingShipmentStopDto
{
    /// <summary>
    /// Order of the stop in the shipment route
    /// </summary>
    public int Order {get; set; }

    /// <summary>
    /// Public ID of the related client
    /// </summary>
    public Guid ClientId { get; set; }

    /// <summary>
    /// Name of the related client
    /// </summary>
    public string ClientName { get; set; } = null!;

    /// <summary>
    /// Official address of the client
    /// </summary>
    public AddressDto OfficialAddress { get; set; } = null!;

    /// <summary>
    /// Contact address of the client
    /// </summary>
    public AddressDto? ContactAddress { get; set; }

    /// <summary>
    /// ID of the order associated with this stop
    /// </summary>
    public Guid OrderId { get; set; }

    /// <summary>
    /// Products to be delivered at this stop

/// <summary>
/// Data transfer object representing a product included in an outgoing shipment.
/// </summary>
    public List<OutgoingShipmentProductDto> Products { get; set; } = [];
}

public sealed record OutgoingShipmentProductDto
{
    /// <summary>
    /// ID of the product
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Name of the product
    /// </summary>
    public string Name { get; set; } = null!;

    /// <summary>
    /// Quantity of the product to be delivered
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
}