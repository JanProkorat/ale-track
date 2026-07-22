using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;

namespace AleTrack.Entities;

/// <summary>
/// A returnable item the client hands back during an outgoing shipment
/// (empty kegs, bottles, crates…). Free-form name + amount, not a catalog product.
/// </summary>
[Table("outgoing_shipment_returns")]
public sealed class OutgoingShipmentReturn : PublicEntity
{
    /// <summary>
    /// ID of the outgoing shipment
    /// </summary>
    [Column("outgoing_shipment_id")]
    public long OutgoingShipmentId { get; set; }

    /// <summary>
    /// Name of the returned item (e.g. "Sud 50 l — prázdný")
    /// </summary>
    [MaxLength(200)]
    [Column("name")]
    public string Name { get; set; } = null!;

    /// <summary>
    /// Amount returned
    /// </summary>
    [Column("quantity")]
    public int Quantity { get; set; }

    /// <summary>
    /// Outgoing shipment associated with this returned item
    /// </summary>
    public OutgoingShipment OutgoingShipment { get; set; } = null!;
}
