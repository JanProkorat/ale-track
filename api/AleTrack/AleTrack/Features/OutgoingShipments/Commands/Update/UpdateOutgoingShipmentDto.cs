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
    /// Where the run is loaded before it sets off. Defaults to the company warehouse.
    /// </summary>
    public ShipmentStartPointKind StartPointKind { get; set; } = ShipmentStartPointKind.Company;

    /// <summary>
    /// Public ID of the brewery the run starts at. Required when
    /// <see cref="StartPointKind"/> is <see cref="ShipmentStartPointKind.Brewery"/>,
    /// and must be null otherwise.
    /// </summary>
    public Guid? StartBreweryId { get; set; }
    
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
    /// Custom (non-order) waypoints on the route
    /// </summary>
    public List<CustomStopDto> CustomStops { get; set; } = [];

    /// <summary>
    /// Via points that shape the road route (not visited stops)
    /// </summary>
    public List<RoutePointDto> RouteViaPoints { get; set; } = [];

    /// <summary>
    /// State of the outgoing shipment
    /// </summary>
    public OutgoingShipmentState State { get; set; }
    
    /// <summary>
    /// Extra products to be delivered to the inventory from the brewery
    /// </summary>
    public List<StockPurchaseDto> StockPurchases { get; set; } = [];
    
    /// <summary>
    /// Extra products to be delivered from the inventory to the client
    /// </summary>
    public List<ClientExtraShipmentDto> ClientExtraShipments { get; set; } = [];
    
    /// <summary>
    /// Custom extra products to be delivered to the client
    /// </summary>
    public List<CustomExtraShipmentDto> CustomExtraShipments { get; set; } = [];

    /// <summary>
    /// Checklist of what has to be done while preparing the run. Steps already stored keep the
    /// tick they have; steps missing from this list are removed.
    /// </summary>
    public List<PreparationStepDto> PreparationSteps { get; set; } = [];
}