using AleTrack.Common.Enums;
using AleTrack.Features.OutgoingShipments.Utils;

namespace AleTrack.Features.OutgoingShipments.Commands.Update;

/// <summary>
/// Data transfer object for updating an existing outgoing shipment.
/// </summary>
public sealed record UpdateOutgoingShipmentDto
{
    /// <summary>
    /// Name of the outgoing shipment
    /// </summary>
    public string Name { get; set; } = null!;
    
    /// <summary>
    /// Date when shipments are going to be delivered
    /// </summary>
    public DateTime? DeliveryDate { get; set; }
    
    /// <summary>
    /// ID of the vehicle that will be used to deliver the shipments
    /// </summary>
    public Guid? VehicleId { get; set; }

    /// <summary>
    /// List of driver IDs that will be assigned to the shipment
    /// </summary>
    public List<Guid> DriverIds { get; set; } = [];

    /// <summary>
    /// List of client order shipments to be included in the outgoing shipment
    /// </summary>
    public List<ClientOrderShipmentDto> ClientOrderShipments { get; set; } = [];

    /// <summary>
    /// State of the outgoing shipment
    /// </summary>
    public OutgoingShipmentState State { get; set; }
    
    /// <summary>
    /// Extra products to be delivered to the garage
    /// </summary>
    public List<ExtraShipmentDto> ExtraShipments { get; set; } = [];
}

/// <summary>
/// Data transfer object for adding extra products to an outgoing shipment.
/// </summary>
public record ExtraShipmentDto
{
    /// <summary>
    /// ID of related product
    /// </summary>
    public Guid? ProductId { get; set; }
    
    /// <summary>
    /// Represents the quantity of the product in the shipment
    /// </summary>
    public int Quantity { get; set; }
    
    /// <summary>
    /// Name of the product. Filled only if <see cref="ProductId"/> is null.
    /// </summary>
    public string? ProductName { get; set; }
    
    /// <summary>
    /// FLag indicating if the loading of the order item is confirmed
    /// </summary>
    public bool IsLoadingConfirmed { get; set; }
}