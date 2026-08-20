using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Represents an outgoing shipment entity.
/// </summary>
[Table("outgoing_shipments")]
public sealed class OutgoingShipment : PublicEnumSoftlyDeletableEntity<OutgoingShipmentState>
{
    /// <summary>
    /// Name of the outgoing shipment
    /// </summary>
    [Column("name")]
    [MaxLength(100)]
    [Required]
    public string Name { get; set; } = null!;
    
    /// <summary>
    /// Date of delivery
    /// </summary>
    [Column("delivery_date")]
    public DateTime? DeliveryDate { get; set; }

    /// <summary>
    /// Where the run is loaded before it sets off.
    /// </summary>
    /// <remarks>
    /// Runs created before this existed default to
    /// <see cref="ShipmentStartPointKind.Company"/>, which is exactly what the
    /// hardcoded depot origin used to mean.
    /// </remarks>
    [Column("start_point_kind")]
    public ShipmentStartPointKind StartPointKind { get; set; } = ShipmentStartPointKind.Company;

    /// <summary>
    /// The brewery the run is loaded at. Set only when
    /// <see cref="StartPointKind"/> is <see cref="ShipmentStartPointKind.Brewery"/>.
    /// </summary>
    [Column("start_brewery_id")]
    public long? StartBreweryId { get; set; }

    /// <summary>
    /// Brewery the run starts at. Restricted rather than cascaded: deleting a brewery
    /// a planned run loads at should fail loudly, not delete the run.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Restrict)]
    public Brewery? StartBrewery { get; set; }

    /// <summary>
    /// Which of the start brewery's addresses the run is loaded at. Meaningless when
    /// <see cref="StartPointKind"/> is <see cref="ShipmentStartPointKind.Company"/>, and
    /// restricted to <see cref="DeliveryAddressKind.Official"/>/<see cref="DeliveryAddressKind.Contact"/>
    /// — a brewery has no delivery-place navigation.
    /// </summary>
    [Column("start_brewery_address_kind")]
    public DeliveryAddressKind StartBreweryAddressKind { get; set; } = DeliveryAddressKind.Official;

    /// <summary>
    /// Date when the shipment was created
    /// </summary>
    [Column("created_date")]
    public DateTime CreatedDate { get; set; }
    
    /// <summary>
    /// ID of the vehicle used for the shipment
    /// </summary>
    [Column("vehicle_id")]
    public long? VehicleId { get; set; }

    /// <summary>
    /// Vehicle used for the shipment
    /// </summary>
    public Vehicle? Vehicle { get; set; }

    /// <summary>
    /// List of drivers associated with this outgoing shipment
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public ICollection<OutgoingShipmentDriver> Drivers { get; set; } = [];

    /// <summary>
    /// List of stops in this outgoing shipment
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public ICollection<OutgoingShipmentStop> Stops { get; set; } = [];

    [DeleteBehavior(DeleteBehavior.Cascade)]
    public ICollection<OutgoingShipmentRoutePoint> RouteViaPoints { get; set; } = [];

    /// <summary>
    /// Goods bought from the brewery on this run for our own warehouse ("Zboží na sklad").
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public ICollection<OutgoingShipmentStockPurchaseItem> StockPurchases { get; set; } = [];

    /// <summary>
    /// Invoices to be issued for this shipment — by default one per client on the route.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public ICollection<OutgoingShipmentInvoice> Invoices { get; set; } = [];

    /// <summary>
    /// Invoices the brewery issues to us for the goods picked up on this run.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public ICollection<OutgoingShipmentPurchaseInvoice> PurchaseInvoices { get; set; } = [];

    /// <summary>
    /// How far each product has got through loading, per brewery-invoice column.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public ICollection<OutgoingShipmentLoadingState> LoadingStates { get; set; } = [];

    /// <summary>
    /// Checklist of what has to be done while preparing this run.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public ICollection<OutgoingShipmentPreparationStep> PreparationSteps { get; set; } = [];

    /// <inheritdoc/>
    protected override OutgoingShipmentState CancelledStatus => OutgoingShipmentState.Cancelled;

    /// <summary>
    /// Indicates whether the outgoing shipment has all required data filled
    /// </summary>
    public bool HasFilledData => DeliveryDate.HasValue 
            && VehicleId.HasValue 
            && Drivers.Count > 0 
            && Stops.Count > 0;
    
    /// <summary>
    /// Planning state of the outgoing shipment
    /// </summary>
    /// <exception cref="ArgumentOutOfRangeException"></exception>
    public PlanningState PlanningState
    {
        get
        {
            return State switch
            {
                OutgoingShipmentState.Created or OutgoingShipmentState.Loaded or OutgoingShipmentState.InTransit => PlanningState.Active,
                OutgoingShipmentState.Delivered => PlanningState.Finished,
                OutgoingShipmentState.Cancelled => PlanningState.Cancelled,
                _ => throw new ArgumentOutOfRangeException()
            };
        }
    }
}