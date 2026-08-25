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
    /// Rows of the invoice split the office has confirmed as finished, with the numbers they were
    /// confirmed under. A row nobody has ever marked has no entry here.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public ICollection<OutgoingShipmentInvoiceConfirmation> InvoiceConfirmations { get; set; } = [];

    /// <summary>
    /// When the run's invoicing was filed — after which its orders are closed to editing and
    /// deviations are recorded against them instead. Null until somebody files it.
    /// </summary>
    /// <remarks>
    /// The one-way door of the whole run. Up to it, the office moves freely: a row is marked
    /// finished and unmarked again, an order is corrected the ordinary way, the export is taken
    /// afresh. Past it, the plan is what was filed and everything that happens at the door is a
    /// deviation beside it — which is what makes the two editing modes impossible to hold at
    /// once, and why nothing here undoes it.
    ///
    /// Not the shipment's state: an order legitimately changes while a run is loaded or on the
    /// road, and only filing the paperwork ends that.
    /// </remarks>
    [Column("invoicing_filed_at")]
    public DateTime? InvoicingFiledAt { get; set; }

    /// <summary>
    /// Who filed it. Kept because the act cannot be undone: when somebody asks why an order is
    /// locked, this is the only answer there is.
    /// </summary>
    [Column("invoicing_filed_by_user_id")]
    public long? InvoicingFiledByUserId { get; set; }

    /// <inheritdoc cref="InvoicingFiledByUserId" />
    [DeleteBehavior(DeleteBehavior.SetNull)]
    public User? InvoicingFiledByUser { get; set; }

    /// <summary>Whether the run's invoicing has been filed.</summary>
    public bool IsInvoicingFiled => InvoicingFiledAt is not null;

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