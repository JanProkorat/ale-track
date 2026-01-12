using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Represents a stop in an outgoing shipment
/// </summary>
[Table("outgoing_shipment_stops")]
public sealed class OutgoingShipmentStop : PublicEntity
{
    /// <summary>
    /// ID of the outgoing shipment
    /// </summary>
    [Column("outgoing_shipment_id")]
    public long OutgoingShipmentId { get; set; }

    /// <summary>
    /// Order of the stop in the shipment route
    /// </summary>
    [Column("order")]
    public int Order { get; set; }

    /// <summary>
    /// ID of the order associated with this stop
    /// </summary>
    [Column("client_order_id")]
    public long ClientOrderId { get; set; }

    /// <summary>
    /// Outgoing shipment associated with this stop
    /// </summary>
    public OutgoingShipment OutgoingShipment { get; set; } = null!;

    /// <summary>
    /// Order associated with this stop
    /// </summary>
    public Order ClientOrder { get; set; } = null!;
}