using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Represents the junction entity for the many-to-many relationship between OutgoingShipment and Driver
/// </summary>
[Table("outgoing_shipment_drivers")]
public sealed class OutgoingShipmentDriver : BaseEntity
{
    /// <summary>
    /// ID of the outgoing shipment
    /// </summary>
    [Column("outgoing_shipment_id")]
    public long OutgoingShipmentId { get; set; }

    /// <summary>
    /// ID of the driver
    /// </summary>
    [Column("driver_id")]
    public long DriverId { get; set; }

    /// <summary>
    /// Driver associated with this outgoing shipment
    /// </summary>
    [DeleteBehavior(DeleteBehavior.NoAction)]
    public Driver Driver { get; set; } = null!;

    /// <summary>
    /// Outgoing shipment associated with this driver
    /// </summary>
    public OutgoingShipment OutgoingShipment { get; set; } = null!;

}