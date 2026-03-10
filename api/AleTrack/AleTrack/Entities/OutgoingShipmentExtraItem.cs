using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// Represents an extra product item included in an outgoing shipment (not tied to a client order)
/// </summary>
[Table("outgoing_shipment_extra_items")]
public sealed class OutgoingShipmentExtraItem : BaseEntity
{
    /// <summary>
    /// ID of the outgoing shipment
    /// </summary>
    [Column("outgoing_shipment_id")]
    public long OutgoingShipmentId { get; set; }

    /// <summary>
    /// ID of the product
    /// </summary>
    [Column("product_id")]
    public long? ProductId { get; set; }

    /// <summary>
    /// Quantity of the product
    /// </summary>
    [Column("quantity")]
    public int Quantity { get; set; }

    /// <summary>
    /// Name of the product. Filled only if <see cref="Product"/> is null.
    /// </summary>
    [Column("product_name")]
    [MaxLength(200)]
    public string? ProductName { get; set; }
    
    /// <summary>
    /// Flag indicating whether the loading in a related outgoing shipment is confirmed.
    /// </summary>
    [Column("is_shipment_loading_confirmed")]
    public bool IsShipmentLoadingConfirmed { get; set; }
    
    /// <summary>
    /// Outgoing shipment associated with this extra item
    /// </summary>
    public OutgoingShipment OutgoingShipment { get; set; } = null!;

    /// <summary>
    /// Product associated with this extra item
    /// </summary>
    [DeleteBehavior(DeleteBehavior.NoAction)]
    public Product? Product { get; set; }
}
