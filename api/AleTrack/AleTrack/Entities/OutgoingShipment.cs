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