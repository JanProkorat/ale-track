using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Features.OutgoingShipments.Commands.Update;

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
    /// Name of the outgoing shipment
    /// </summary>
    public string Name { get; set; } = null!;
    
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

    /// <summary>
    /// List of extra product items included in the shipment to be delivered to the inventory
    /// </summary>
    public List<OutgoingShipmentInventoryExtraItemDto> InventoryExtraItems { get; set; } = [];
    
    /// <summary>
    /// List of extra product items included in the shipment to be delivered to the client taken from the inventory
    /// </summary>
    public List<OutgoingShipmentClientExtraItemDto> ClientExtraItems { get; set; } = [];
    
    /// <summary>
    /// List of custom extra product items included in the shipment
    /// </summary>
    public List<OutgoingShipmentCustomExtraItemDto> CustomExtraItems { get; set; } = [];
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
    /// Kind of the selected address for the shipment
    /// </summary>
    public OutgoingShipmentStopAddressKind SelectedAddressKind { get; set; }
    
    /// <summary>
    /// Products to be delivered at this stop
    /// </summary>
    public List<OutgoingShipmentOrderItemDto> Products { get; set; } = [];
}

public record OutgoingShipmentProductDto
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
    public ProductKind? Kind { get; set; }
    
    /// <summary>
    /// Size of the whole package
    /// </summary>
    public double? PackageSize { get; set; }
    
    /// <summary>
    /// Weight of the product in kilograms
    /// </summary>
    public double? Weight { get; set; }
    
    /// <summary>
    /// Flag indicating whether the loading in a related outgoing shipment is confirmed.
    /// </summary>
    public bool IsShipmentLoadingConfirmed { get; set; }
    
    /// <summary>
    /// Number of pieces to be put on the first invoice
    /// </summary>
    public int? FirstInvoiceQuantity { get; set; }
    
    /// <summary>
    /// Number of pieces to be put on the second invoice
    /// </summary>
    public int? SecondInvoiceQuantity { get; set; }
}

/// <summary>
/// Data transfer object representing a product item in an outgoing shipment taken from an order.
/// </summary>
public sealed record OutgoingShipmentOrderItemDto : OutgoingShipmentProductDto
{
    /// <summary>
    /// ID of the related order item
    /// </summary>
    public Guid OrderItemId { get; set; }    
}

/// <summary>
/// Data transfer object representing a product item in an outgoing shipment to be delivered to the inventory
/// </summary>
public sealed record OutgoingShipmentInventoryExtraItemDto : OutgoingShipmentProductDto
{
    /// <summary>
    /// ID of the related product
    /// </summary>
    public Guid ProductId { get; set; }
}

/// <summary>
/// Data transfer object representing an extra product item in an outgoing shipment taken from the inventory
/// and to be delivered to the client.
/// </summary>
public record OutgoingShipmentClientExtraItemDto : OutgoingShipmentProductDto
{
    /// <summary>
    /// ID of the inventory item this extra product is taken from.
    /// Null if its taken from clients order and not from inventory.
    /// </summary>
    public Guid InventoryItemId { get; set; }
    
    /// <summary>
    /// ID of the related product.
    /// </summary>
    public Guid? ProductId { get; set; }   
}

/// <summary>
/// Data transfer object representing a custom extra product item in an outgoing shipment.
/// </summary>
public record OutgoingShipmentCustomExtraItemDto : OutgoingShipmentProductDto
{
}
