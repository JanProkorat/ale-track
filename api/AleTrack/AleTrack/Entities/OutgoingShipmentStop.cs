using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

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
    /// Kind of the selected address for the shipment (order stops only)
    /// </summary>
    [Column("selected_address_kind")]
    public DeliveryAddressKind SelectedAddressKind { get; set; }

    /// <summary>
    /// The client's saved delivery place this stop delivers to. Set only when
    /// <see cref="SelectedAddressKind"/> is
    /// <see cref="DeliveryAddressKind.DeliveryPlace"/>.
    /// </summary>
    [Column("client_delivery_place_id")]
    public long? ClientDeliveryPlaceId { get; set; }

    /// <summary>
    /// True when the planner chose an address other than the one the stop's
    /// order says. This is what suppresses propagation: an order edit rewrites
    /// an inherited stop's address, never an overridden one. Derived at write
    /// time by comparing the requested choice against the order's — never sent
    /// by the client.
    /// </summary>
    [Column("is_address_overridden")]
    public bool IsAddressOverridden { get; set; }

    /// <summary>
    /// Stamped when an order edit changed the delivery address under this
    /// active shipment — whether or not the change propagated here. Drives the
    /// shipment banner; cleared by acknowledging it or by saving the shipment.
    /// </summary>
    [Column("address_changed_at")]
    public DateTime? AddressChangedAt { get; set; }

    /// <summary>
    /// Public ID of the client this stop delivered to, snapshotted when the run was loaded. Null
    /// for custom stops and for stops on runs that never left
    /// <see cref="OutgoingShipmentState.Created"/>.
    /// </summary>
    /// <remarks>
    /// The stop already snapshots the delivery address; client attribution completes that
    /// pattern. The volume reports group by client and region, so renaming a client or moving it
    /// between regions used to rewrite past reports.
    /// </remarks>
    [Column("client_public_id")]
    public Guid? ClientPublicId { get; set; }

    /// <summary>Client name as it was when the run was loaded.</summary>
    [MaxLength(100)]
    [Column("client_name")]
    public string? ClientName { get; set; }

    /// <summary>Client region as it was when the run was loaded.</summary>
    [Column("client_region")]
    public Region? ClientRegion { get; set; }

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

    /// <summary>
    /// Delivery place associated with this stop. Deliberately resolvable even
    /// when soft-deleted, so historical shipments keep rendering.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Restrict)]
    public ClientDeliveryPlace? ClientDeliveryPlace { get; set; }

    /// <summary>
    /// What this stop carried, snapshotted at loading time. Empty while the run is still in
    /// <see cref="OutgoingShipmentState.Created"/>.
    /// </summary>
    public ICollection<OutgoingShipmentStopItem> Items { get; set; } = [];
}
