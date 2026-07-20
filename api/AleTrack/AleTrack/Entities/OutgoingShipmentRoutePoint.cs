using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;

namespace AleTrack.Entities;

/// <summary>
/// A via point that shapes an outgoing shipment's road route without being a
/// visited stop. The map assigns each via to its nearest route segment when
/// drawing, so only its coordinates need to persist.
/// </summary>
[Table("outgoing_shipment_route_points")]
public sealed class OutgoingShipmentRoutePoint : BaseEntity
{
    /// <summary>
    /// ID of the outgoing shipment.
    /// </summary>
    [Column("outgoing_shipment_id")]
    public long OutgoingShipmentId { get; set; }

    /// <summary>
    /// Stable ordering of the via within the shipment.
    /// </summary>
    [Column("order")]
    public int Order { get; set; }

    /// <summary>
    /// Latitude of the via point.
    /// </summary>
    [Column("latitude")]
    public decimal Latitude { get; set; }

    /// <summary>
    /// Longitude of the via point.
    /// </summary>
    [Column("longitude")]
    public decimal Longitude { get; set; }

    /// <summary>
    /// Outgoing shipment this via belongs to.
    /// </summary>
    public OutgoingShipment OutgoingShipment { get; set; } = null!;
}
