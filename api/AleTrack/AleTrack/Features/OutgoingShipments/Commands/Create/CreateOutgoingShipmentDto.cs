using AleTrack.Common.Enums;
using AleTrack.Features.OutgoingShipments.Utils;

namespace AleTrack.Features.OutgoingShipments.Commands.Create;

public sealed record CreateOutgoingShipmentDto
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
    /// Custom (non-order) waypoints on the route.
    /// </summary>
    public List<CustomStopDto> CustomStops { get; set; } = [];

    /// <summary>
    /// Via points that shape the road route (not visited stops).
    /// </summary>
    public List<RoutePointDto> RouteViaPoints { get; set; } = [];

    /// <summary>
    /// Checklist of what has to be done while preparing the run. Every step starts unticked, so
    /// the DTO's <c>Id</c> is ignored here.
    /// </summary>
    public List<PreparationStepDto> PreparationSteps { get; set; } = [];
}