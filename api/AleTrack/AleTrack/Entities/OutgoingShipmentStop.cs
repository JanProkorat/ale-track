using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;

namespace AleTrack.Entities;

/// <summary>
/// Represents a stop in an outgoing shipment. A stop is either tied to a client
/// order (<see cref="OutgoingShipmentStopKind.Order"/>) or a free-form custom
/// waypoint (<see cref="OutgoingShipmentStopKind.Custom"/>).
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
    /// Kind of the stop — order-based or a custom waypoint.
    /// </summary>
    [Column("kind")]
    public OutgoingShipmentStopKind Kind { get; set; }

    /// <summary>
    /// ID of the order associated with this stop. Null for custom stops.
    /// </summary>
    [Column("client_order_id")]
    public long? ClientOrderId { get; set; }

    /// <summary>
    /// Kind of the selected address for the shipment (order stops only)
    /// </summary>
    [Column("selected_address_kind")]
    public OutgoingShipmentStopAddressKind SelectedAddressKind { get; set; }

    /// <summary>
    /// Label of a custom stop (null for order stops).
    /// </summary>
    [Column("label")]
    [MaxLength(100)]
    public string? Label { get; set; }

    /// <summary>
    /// Note of a custom stop.
    /// </summary>
    [Column("note")]
    [MaxLength(200)]
    public string? Note { get; set; }

    /// <summary>
    /// Latitude of a custom stop (null for order stops — their coordinates come
    /// from the client address).
    /// </summary>
    [Column("latitude")]
    public decimal? Latitude { get; set; }

    /// <summary>
    /// Longitude of a custom stop.
    /// </summary>
    [Column("longitude")]
    public decimal? Longitude { get; set; }

    /// <summary>
    /// Outgoing shipment associated with this stop
    /// </summary>
    public OutgoingShipment OutgoingShipment { get; set; } = null!;

    /// <summary>
    /// Order associated with this stop. Null for custom stops.
    /// </summary>
    public Order? ClientOrder { get; set; }
}
